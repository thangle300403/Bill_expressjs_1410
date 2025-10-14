const productModel = require('../models/Product');
const categoryModel = require('../models/Category');
const session = require('express-session');

class HomeController {
    static index = async (req, res) => {

        try {
            const page = 1;
            const item_per_page = 4;
            const conds = [];
            let sorts = { featured: 'DESC' };
            const featuredProducts = await productModel.getBy(conds, sorts, page, item_per_page);
            //select * from view_product oder by featured desc limit 0, 4

            sorts = { created_date: 'DESC' };
            const latestProducts = await productModel.getBy(conds, sorts, page, item_per_page);
            //select * from view_product oder by featured desc limit 0, 4

            //get product by catagory
            //contain all catagories
            //each catahgory contain: name catagory and following product
            const categoryProducts = [];

            //get all the catagories
            const categories = await categoryModel.all();

            for (const category of categories) {
                const categoryName = category.name;
                //get product by the same category
                //same category means same category_id
                const conds = {
                    'category_id': {
                        'type': '=',
                        'val': category.id
                    }
                }
                const products = await productModel.getBy(conds, sorts, page, item_per_page);

                categoryProducts.push({
                    categoryName: categoryName,
                    products: products
                })
            }
            res.render('home/index', {
                featuredProducts: featuredProducts,
                latestProducts: latestProducts,
                categoryProducts: categoryProducts,
            });
        } catch (error) {
            res.status(500).send(error.message);
        }
    }
}
module.exports = HomeController;