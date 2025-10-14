const session = require('express-session');
const statusModel = require('../../models/Status');
const orderModel = require('../../models/Order');

class AdminStatusController {
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
                //select * from view_status where name like '%kem%'
            }
            // /danh-muc/sua-tam/c4.html
            const statuses = await statusModel.getBy(conds, sorts, page, item_per_page);

            const allStatuses = await statusModel.getBy(conds, sorts);

            const totalPage = Math.ceil(allStatuses.length / item_per_page); //để phân trag


            res.render('admin/status/index', {
                statuses: statuses,
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
            res.render('admin/status/create', {
                layout: 'admin/layout',
            });
        } catch (error) {
            res.status(500).send(error.message);
        }
    }

    static store = async (req, res) => {
        try {
            statusModel.save(req.body);
            req.session.message_success = `Tạo trạng thái ${req.body.name} thành công.`;
            req.session.save(() => {
                res.redirect('/admin/status');
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static edit = async (req, res) => {
        try {
            const status = await statusModel.find(req.params.id);
            res.render('admin/status/edit', {
                status: status,
                layout: 'admin/layout',
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static update = async (req, res) => {
        try {
            const id = req.body.id;
            await statusModel.update(id, {
                name: req.body.name,
                description: req.body.description,
            });
            // Update session message for success
            req.session.message_success = `Sửa thông tin trạng thái '${req.body.name}' thành công!`;
            req.session.save(() => {
                res.redirect('/admin/status');
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }
}
module.exports = AdminStatusController;