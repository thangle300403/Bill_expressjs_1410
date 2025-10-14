const session = require('express-session');
const categoryModel = require('../../models/Category');
const productModel = require('../../models/Product');

class CategoryController {
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
                //select * from view_category where name like '%kem%'
            }
            // /danh-muc/sua-tam/c4.html
            const categories = await categoryModel.getBy(conds, sorts, page, item_per_page);

            const allCategories = await categoryModel.getBy(conds, sorts);

            const totalPage = Math.ceil(allCategories.length / item_per_page); //để phân trag

            res.render('admin/category/index', {
                categories: categories,
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
            res.render('admin/category/create', {
                layout: 'admin/layout',
            });
        } catch (error) {
            res.status(500).send(error.message);
        }
    }

    static store = async (req, res) => {
        try {
            categoryModel.save(req.body);
            req.session.message_success = `Tạo danh mục ${req.body.name} thành công.`;
            req.session.save(() => {
                res.redirect('/admin/category');
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static edit = async (req, res) => {
        try {
            const category = await categoryModel.find(req.params.id);
            res.render('admin/category/edit', {
                category: category,
                layout: 'admin/layout',
            })
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static update = async (req, res) => {
        try {
            const id = req.body.id;
            await categoryModel.update(id, {
                name: req.body.name,
            });
            // Update session message for success
            req.session.message_success = `Sửa danh mục ${req.body.name} thành công!`;
            req.session.save(() => {
                res.redirect('/admin/category');
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static destroy = async (req, res) => {
        try {
            const id = req.params.id;
            const category = await categoryModel.find(req.params.id);
            const products = await productModel.findByCategory(id);
            if (products.length) {
                req.session.message_error = `Không thể xóa danh mục ${category.name} vì có ${products.length} sản phẩm đang thuộc danh mục này!`;
                req.session.save(() => {
                    res.redirect('/admin/category');
                });
            } else {
                await categoryModel.destroy(id);
                req.session.message_success = `Xóa danh mục ${category.name} thành công!`;
                req.session.save(() => {
                    res.redirect('/admin/category');
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
module.exports = CategoryController;