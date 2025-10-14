const session = require('express-session');
const actionModel = require('../../models/Action');
class AdminActionController {
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
                //select * from view_action where name like '%kem%'
            }
            // /danh-muc/sua-tam/c4.html
            const actions = await actionModel.getBy(conds, sorts, page, item_per_page);

            const allActions = await actionModel.getBy(conds, sorts);

            const totalPage = Math.ceil(allActions.length / item_per_page); //để phân trag

            res.render('admin/action/index', {
                actions: actions,
                totalPage: totalPage,
                page: page,
                layout: 'admin/layout',
                search: search
            });
        } catch (error) {
            res.status(500).send(error.message);
        }
    }

    static edit = async (req, res) => {
        try {
            const action = await actionModel.find(req.params.id);
            res.render('admin/action/edit', {
                action: action,
                layout: 'admin/layout',
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static update = async (req, res) => {
        try {
            const id = req.body.id;
            const name = Array.isArray(req.body.name) ? req.body.name[0] : req.body.name;
            const description = Array.isArray(req.body.description) ? req.body.description[0] : req.body.description;

            // Perform the update
            await actionModel.update(id, {
                name: name,
                description: description
            });

            // Update session message for success
            req.session.message_success = `Sửa tác vụ '${name}' thành công!`;
            req.session.save(() => {
                res.redirect('/admin/action');
            });
        } catch (error) {
            console.error('Error updating action:', error.message);
            throw new Error(error.message);
        }
    };


}
module.exports = AdminActionController;