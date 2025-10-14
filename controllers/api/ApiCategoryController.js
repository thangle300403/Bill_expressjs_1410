const categoryModel = require('../../models/Category');

class ApiCategoryController {
    static index = async (req, res) => {
        try {
            const categories = await categoryModel.all();

            const simplifiedCategories = categories.map(cat => {
                const obj = cat.toJSON ? cat.toJSON() : { ...cat };
                return {
                    id: obj.id,
                    name: obj.name
                };
            });

            const response = {
                items: simplifiedCategories,
                totalItem: simplifiedCategories.length
            };

            res.json(response);
        } catch (error) {
            res.status(500).send(error.message);
        }
    }
}

module.exports = ApiCategoryController;
