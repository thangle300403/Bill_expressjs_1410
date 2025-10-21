const session = require('express-session');
const productModel = require('../../models/Product');
const categoryModel = require('../../models/Category');
const brandModel = require('../../models/Brand');
const orderItemModel = require('../../models/OrderItem');
const commentModel = require('../../models/Comment');
const imageItemModel = require('../../models/ImageItem');
const axios = require("axios");
const path = require('path');
const { features } = require('process');
const fs = require('fs');
const { pipeline } = require('stream');
const util = require('util');
const { invalidateChromaCache, runProductSeeds } = require('../api/Chatbot/runInitialSeed');
const { updateSingleProductEmbedding } = require('../api/Chatbot/initAgents/productDesChroma');
const { invalidateProductCache } = require('../api/Chatbot/cache/productCache');
const { summarizeDescription } = require('./summarizeDescription');
const pipelineAsync = util.promisify(pipeline);

// Go up two levels from the current directory
class AdminProductController {
    //trả về view -> (req, res)
    static index = async (req, res) => {
        try {
            const page = req.query.page || 1;
            const item_per_page = process.env.PRODUCT_ITEM_PER_PAGE;
            let conds = {};
            let sorts = {};

            const search = req.query.search;
            if (search) {
                conds.name = {
                    type: 'LIKE',
                    val: `'%${search}%'`
                }
                //select * from view_product where name like '%kem%'
            }
            // /danh-muc/sua-tam/c4.html
            const products = await productModel.getBy(conds, sorts, page, item_per_page);

            const categories = await categoryModel.all();

            const allProducts = await productModel.getBy(conds, sorts);

            const totalPage = Math.ceil(allProducts.length / item_per_page); //để phân trag

            const featured = {
                1: 'Nổi bật',
                0: 'Không nổi bật'
            }


            res.render('admin/product/index', {
                featured: featured,
                products: products,
                totalPage: totalPage,
                page: page,
                categories: categories,
                layout: 'admin/layout',
                search: search
            });
        } catch (error) {
            res.status(500).send(error.message);
        }
    }

    static create = async (req, res) => {
        const categories = await categoryModel.all();
        const brands = await brandModel.all();
        try {
            res.render('admin/product/create', {
                categories: categories,
                brands: brands,
                layout: 'admin/layout',
            });
        } catch (error) {
            res.status(500).send(error.message);
        }
    }

    static store = async (req, res) => {
        try {
            const { fields, files } = await req.app.locals.helpers.parseForm(req);
            const oldpath = files.img[0].filepath;
            const newpath = req.app.locals.uploadDir + '/' + files.img[0].originalFilename;
            await req.app.locals.helpers.copyFile(oldpath, newpath);
            const data = {
                barcode: fields.barcode[0],
                sku: fields.sku[0],
                name: fields.name[0],
                price: fields.price[0],
                discount_percentage: fields.discount_percentage[0],
                discount_from_date: fields.discount_from_date[0],
                discount_to_date: fields.discount_to_date[0],
                featured_image: files.img[0].originalFilename,
                inventory_qty: fields.inventory_qty[0],
                category_id: fields.category_id[0],
                brand_id: fields.brand_id[0],
                description: fields.description[0],
                created_date: req.app.locals.helpers.getCurrentDateTime(),
                featured: fields.featured[0]
            }
            const newId = await productModel.save(data);

            const shortDesc = await summarizeDescription(data.description);

            await productModel.update(newId, { short_description: shortDesc });

            req.session.message_success = `Thêm sản phẩm ${data.name} thành công!`;

            invalidateProductCache();

            // ✅ Cập nhật lại embedding cho sản phẩm vừa create
            await updateSingleProductEmbedding(id, "create");

            await axios.post(`${process.env.NEST_URL}/api/v1/products/product-change`, {
                id,
                type: "create",
            });

            req.session.save(() => {
                res.redirect('/admin');
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static edit = async (req, res) => {
        try {
            const brands = await brandModel.all();
            const categories = await categoryModel.all();
            const product = await productModel.find(req.params.id);
            res.render('admin/product/edit', {
                brands: brands,
                categories: categories,
                product: product,
                layout: 'admin/layout',
            })
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static async update(req, res) {
        try {
            // Parse the form data
            const { fields, files } = await req.app.locals.helpers.parseForm(req);
            const id = fields.id[0];

            const oldProduct = await productModel.find(id);

            // Prepare data object for updating
            const data = {
                barcode: fields.barcode[0],
                sku: fields.sku[0],
                name: fields.name[0],
                price: fields.price[0],
                discount_percentage: fields.discount_percentage[0],
                discount_from_date: fields.discount_from_date[0],
                discount_to_date: fields.discount_to_date[0],
                inventory_qty: fields.inventory_qty[0],
                category_id: fields.category_id[0],
                brand_id: fields.brand_id[0],
                description: fields.description[0],
                featured: fields.featured[0],
            };

            // Handle optional image upload
            if (files.img && files.img.length > 0 && files.img[0].originalFilename) {
                const oldpath = files.img[0].filepath;
                const newpath = req.app.locals.uploadDir + '/' + files.img[0].originalFilename;

                try {
                    // Copy the file to the new location
                    await req.app.locals.helpers.copyFile(oldpath, newpath);
                    // Update the `featured_image` field only if a new image is uploaded
                    data.featured_image = files.img[0].originalFilename;
                } catch (err) {
                    throw new Error(`Error copying file: ${err.message}`);
                }
            }

            // Perform the database update
            await productModel.update(fields.id[0], data);

            invalidateProductCache();

            // 🔍 Kiểm tra xem description có thay đổi không
            const oldDesc = (oldProduct?.description || "").trim();
            const newDesc = (fields.description[0] || "").trim();

            if (oldDesc !== newDesc) {
                console.log("🧠 Mô tả thay đổi, bắt đầu rút gọn và cập nhật embedding...");

                // 1️⃣ Gọi summarize
                const shortDesc = await summarizeDescription(newDesc);

                // 2️⃣ Cập nhật short_description
                await productModel.update(id, { short_description: shortDesc });
            } else {
                console.log("ℹ️ Description không thay đổi — bỏ qua summarize & embedding update.");
            }

            // ✅ Cập nhật lại embedding cho sản phẩm vừa update
            await updateSingleProductEmbedding(id, "update");

            //Cập nhật bảng product_embedding
            await axios.post(`${process.env.NEST_URL}/api/v1/products/product-change`, {
                id,
                type: "update",
            });

            // Set success message and redirect
            req.session.message_success = `Sửa thông tin sản phẩm ${data.name} thành công!`;
            req.session.save(() => {
                res.redirect('/admin');
            });
        } catch (error) {
            // Log and handle errors
            console.error('Error updating product:', error.message);
            req.session.message_error = `Có lỗi xảy ra: ${error.message}`;
            req.session.save(() => {
                res.redirect('/admin');
            });
        }
    }

    static destroy = async (req, res) => {
        try {
            const id = req.params.id;
            const product = await productModel.find(req.params.id);
            const orders = await orderItemModel.findByProductId(id);
            if (orders.length) {
                req.session.message_error = `Không thể xóa sản phẩm '${product.name}' vì có ${orders.length} đơn hàng đang chứa sản phẩm này!`;
                req.session.save(() => {
                    res.redirect('/admin');
                });
                return;
            }
            // xóa Comment
            await commentModel.destroyByProductId(id);
            //xóa hình trong imageItem(chi tiết)
            const imageItems = await product.getImageItems();
            for (let i = 0; i < imageItems.length; i++) {
                const imageItem = imageItems[i];
                const image = await imageItem.name;
                await req.app.locals.helpers.deleteFile(req.app.locals.uploadDir + '/' + image);
                await imageItemModel.destroy(imageItem.id);


            }
            //xóa hình table product
            await req.app.locals.helpers.deleteFile(req.app.locals.uploadDir + '/' + product.featured_image);
            //xóa product
            await productModel.destroy(id);
            invalidateProductCache();
            // ✅ Cập nhật lại embedding cho sản phẩm vừa delete
            await updateSingleProductEmbedding(id, "delete");

            await axios.post(`${process.env.NEST_URL}/api/v1/products/product-change`, {
                id,
                type: "delete",
            });

            req.session.message_success = `Xóa sản phẩm ${product.name} thành công!`;
            req.session.save(() => {
                res.redirect('/admin');
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }
    static trending = async (req, res) => {
        try {
            res.end('trending')
        } catch (error) {
            throw new Error(error.message);
        }
    }
}
module.exports = AdminProductController;