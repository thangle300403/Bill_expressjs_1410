const productModel = require('../models/Product');
const categoryModel = require('../models/Category');
const commentModel = require('../models/Comment');

class ProductController {
    static index = async (req, res) => {
        try {
            const page = req.query.page || 1;
            const item_per_page = process.env.PRODUCT_ITEM_PER_PAGE;
            let conds = [];
            let sorts = [];
            // /danh-muc/sua-tam/c4.html
            const category_id = req.params.category_id;
            if (category_id) {
                conds = {
                    'category_id': {
                        'type': '=',
                        'val': category_id
                    }
                }
                //select * from view_product where cagtegory_id = 3
            }

            const priceRange = req.query['price-range'];
            if (priceRange) {
                const temp = priceRange.split("-");
                const start = temp[0];
                const end = temp[1];
                conds = {
                    ...conds,
                    'sale_price': {
                        'type': 'BETWEEN',
                        'val': `${start} AND ${end}`
                    }
                }
                //select * from view_product where sale_price between 1000 and 2000
                if (end == 'greater') {
                    conds = {
                        ...conds,
                        'sale_price': {
                            'type': '>=',
                            'val': start
                        }
                    }
                    //select * from view_product where sale_price >= 1000000
                }
            }
            const sort = req.query.sort;
            if (sort) {
                const temp = sort.split("-");
                const dummyColName = temp[0];//price
                const order = temp[1].toUpperCase();//asc
                const map = {
                    //price is the link, sale_price belongs to dbs
                    price: 'sale_price',
                    alpha: 'name',
                    created: 'created_date'
                }
                const colName = map[dummyColName];
                sorts = {
                    [colName]: order //sale_price: ASC
                }
                //select * from view_product order by sale_price asc
            }

            const search = req.query.search;
            if (search) {
                conds.name = {
                    type: 'LIKE',
                    val: `'%${search}%'`
                }
                //select * from view_product where name like '%kem%'
            }

            const products = await productModel.getBy(conds, sorts, page, item_per_page);

            const allProducts = await productModel.getBy(conds, sorts);

            const totalPage = Math.ceil(allProducts.length / item_per_page); //để phân trag

            const categories = await categoryModel.all();

            res.render('product/index', {
                products: products,
                categories: categories,
                category_id: category_id,
                priceRange: priceRange,
                sort: sort,
                totalPage: totalPage,
                page: page,
                search: search,
            });
        } catch (error) {
            res.status(500).send(error.message);
        }
    }
    static detail = async (req, res) => {
        try {
            const slug = req.params.slug;
            const temp = slug.split('-');
            const id = temp[temp.length - 1];
            const product = await productModel.find(id);
            const imageItems = await product.getImageItems();
            const brand = await product.getBrand();
            const comments = await product.getComments();
            const category_id = product.category_id;
            const categories = await categoryModel.all();
            const conds = {
                'category_id': {
                    'type': '=',
                    'val': product.category_id,
                },
                'id': {
                    'type': '!=',
                    'val': product.id,
                },
                //select * from view_product where category_id = 3 and id != 2
            }
            const relatedProducts = await product.getBy(conds);
            res.render('product/detail', {
                product: product,
                imageItems: imageItems,
                brand: brand,
                comments: comments,
                relatedProducts: relatedProducts,
                category_id: category_id,
                categories: categories,
            });
        } catch (error) {
            res.status(500).send(error.message);
        }
    }
    static storeComment = async (req, res) => {
        try {
            const data = {
                product_id: req.body.product_id,
                email: req.body.email,
                fullname: req.body.fullname,
                star: req.body.rating,
                created_date: req.app.locals.helpers.getCurrentDateTime(),
                description: req.body.description
            }
            await commentModel.save(data);
            const product = await productModel.find(data.product_id);
            const comments = await product.getComments();
            res.render('product/comments', {
                comments: comments,
                layout: false
            });
        } catch (error) {
            res.status(500).send(error.message);
        }
    }
}
module.exports = ProductController;