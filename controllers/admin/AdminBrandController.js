const session = require('express-session');
const brandModel = require('../../models/Brand');
const productModel = require('../../models/Product');

class AdminBrandController {
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
                //select * from view_brand where name like '%kem%'
            }
            // /danh-muc/sua-tam/c4.html
            const brands = await brandModel.getBy(conds, sorts, page, item_per_page);

            const allBrands = await brandModel.getBy(conds, sorts);

            const totalPage = Math.ceil(allBrands.length / item_per_page); //để phân trag


            res.render('admin/brand/index', {
                brands: brands,
                totalPage: totalPage,
                page: page,
                layout: 'admin/layout',
                search: search
            });
        } catch (error) {
            res.status(500).send(error.message);
        }
    }


    static create = (req, res) => {
        try {
            res.render('admin/brand/create', {
                layout: 'admin/layout',
            });
        } catch (error) {
            res.status(500).send(error.message);
        }
    }

    static store = async (req, res) => {
        try {
            brandModel.save(req.body);
            req.session.message_success = `Tạo thương hiệu ${req.body.name} thành công.`;
            req.session.save(() => {
                res.redirect('/admin/brand');
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static edit = async (req, res) => {
        try {
            const brand = await brandModel.find(req.params.id);
            res.render('admin/brand/edit', {
                brand: brand,
                layout: 'admin/layout',
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static update = async (req, res) => {
        try {
            const id = req.body.id;
            await brandModel.update(id, {
                name: req.body.name,
            });
            // Update session message for success
            req.session.message_success = `Sửa thương hiệu ${req.body.name} thành công!`;
            req.session.save(() => {
                res.redirect('/admin/brand');
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static destroy = async (req, res) => {
        try {
            const id = req.params.id;
            const brand = await brandModel.find(req.params.id);
            const products = await productModel.findByBrand(id);
            if (products.length) {
                req.session.message_error = `Không thể xóa thương hiệu ${brand.name} vì có ${products.length} sản phẩm đang thuộc thương hiệu này!`;
                req.session.save(() => {
                    res.redirect('/admin/brand');
                });
            } else {
                await brandModel.destroy(id);
                req.session.message_success = `Xóa thương hiệu ${brand.name} thành công!`;
                req.session.save(() => {
                    res.redirect('/admin/brand');
                });
            }
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
module.exports = AdminBrandController;