const productModel = require('../../models/Product')
const categoryModel = require('../../models/Category');
const commentModel = require('../../models/Comment');

class ProductController {
    static index = async (req, res) => {
        try {
            const baseUrl = process.env.IMAGE_BASE_URL;
            const page = parseInt(req.query.page) || 1;
            const item_per_page = parseInt(process.env.PRODUCT_ITEM_PER_PAGE || 10);
            let conds = {};
            let sorts = {};
            const { featured, latest, hierarchy } = req.query;

            if (hierarchy == 1) {
                const categories = await categoryModel.all();
                const categoryProducts = [];

                for (const category of categories) {
                    const conds = {
                        category_id: {
                            type: '=',
                            val: category.id
                        }
                    };

                    const rawProducts = await productModel.getBy(conds, { created_date: 'DESC' }, 1, item_per_page);
                    const allProducts = await productModel.getBy(conds);
                    const totalItem = allProducts.length;
                    const totalPage = Math.ceil(totalItem / item_per_page);

                    const formatted = rawProducts.map(({ fields, ...rest }) => {
                        return {
                            ...rest,
                            featured_image: baseUrl + rest.featured_image
                        };
                    });

                    categoryProducts.push({
                        categoryName: category.name,
                        items: formatted,
                        totalItem,
                        pagination: {
                            page: 1,
                            totalPage
                        }
                    });
                }

                return res.json(categoryProducts);
            }

            if (featured == 1) {
                sorts = { featured: 'DESC' };
            }

            if (latest == 1) {
                sorts = { created_date: 'DESC' };
            }

            const category_id = req.query.category_id;
            if (category_id) {
                conds.category_id = {
                    type: '=',
                    val: category_id
                };
            }

            const priceRange = req.query['price-range'];
            if (priceRange) {
                const [start, end] = priceRange.split("-");
                if (end === 'greater') {
                    conds.sale_price = {
                        type: '>=',
                        val: start
                    };
                } else {
                    conds.sale_price = {
                        type: 'BETWEEN',
                        val: `${start} AND ${end}`
                    };
                }
            }

            const sort = req.query.sort;
            if (sort) {
                const [dummyColName, orderRaw] = sort.split("-");
                const order = orderRaw.toUpperCase();
                const map = {
                    price: 'sale_price',
                    alpha: 'name',
                    created: 'created_date'
                };
                const colName = map[dummyColName];
                if (colName) {
                    sorts[colName] = order;
                }
            }

            const search = req.query.search;
            if (search) {
                conds.name = {
                    type: 'LIKE',
                    val: `'%${search}%'`
                };
            }


            let products = await productModel.getBy(conds, sorts, page, item_per_page);
            products = products.map(({ fields, ...rest }) => rest);
            products = products.map(product => {
                product.featured_image = baseUrl + product.featured_image
                return product;
            });
            const allProducts = await productModel.getBy(conds, sorts);
            const totalItem = allProducts.length;
            const totalPage = Math.ceil(totalItem / item_per_page);

            res.json({
                items: products,
                totalItem: totalItem,
                pagination: {
                    page: page.toString(),
                    totalPage: totalPage
                }
            });
        } catch (error) {
            res.status(500).json({
                items: [],
                totalItem: 0,
                pagination: {
                    page: req.query.page || "1",
                    totalPage: 0
                },
                error: error.message
            });
        }
    };

    static getComment = async (req, res) => {
        try {
            const product_id = req.params.id;

            const product = await productModel.find(product_id);
            const commentsRaw = await product.getComments();

            const comments = commentsRaw.map(({ fields, ...rest }) => rest);

            res.json(comments); // Return raw list for frontend
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    static detail = async (req, res) => {
        try {
            const slug = req.params.slug;
            if (!slug) {
                return res.status(400).json({ success: false, message: "Slug is required" });
            }

            const parts = slug.split("-");
            const id = parts[parts.length - 1];

            const productRaw = await productModel.find(id);
            if (!productRaw) {
                return res.status(404).json({ success: false, message: "Product not found" });
            }
            const { fields: _, ...product } = productRaw;

            product.featured_image = process.env.IMAGE_BASE_URL + product.featured_image

            const imageItemsRaw = await product.getImageItems();
            const thumbnailItems = imageItemsRaw.map(({ fields, ...rest }) => rest);

            const relatedConds = {
                category_id: {
                    type: '=',
                    val: product.category_id
                },
                id: {
                    type: '!=',
                    val: product.id
                }
            };
            const relatedProductsRaw = await product.getBy(relatedConds);
            const relatedProducts = relatedProductsRaw.map(({ fields, ...rest }) => rest);

            relatedProducts.forEach(product => {
                product.featured_image = process.env.IMAGE_BASE_URL + product.featured_image
            });

            res.json({
                ...product,
                relatedProducts,
                thumbnailItems
            });

        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    static storeComment = async (req, res) => {
        try {
            const data = {
                product_id: req.params.id,
                email: req.body.email,
                fullname: req.body.fullname,
                star: req.body.rating,
                created_date: req.app.locals.helpers.getCurrentDateTime(),
                description: req.body.description,
            };

            await commentModel.save(data);

            const product = await productModel.find(data.product_id);
            const comments = await product.getComments();

            res.json({
                success: true,
                data: {
                    comments
                },
                message: 'Gửi đánh giá thành công.'
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static getShirt = async (req, res) => {
        try {
            const baseUrl = process.env.IMAGE_BASE_URL;
            let shirts = await productModel.getShirt();
            shirts = shirts.map(shirt => {
                shirt.featured_image = baseUrl + "/" + shirt.featured_image
                return shirt;
            });
            res.json(shirts);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = ProductController;
