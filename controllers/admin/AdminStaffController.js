const session = require('express-session');
const staffModel = require('../../models/Staff');
const roleModel = require('../../models/Role');
class AdminStaffController {
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
                //select * from view_staff where name like '%kem%'
            }
            // /danh-muc/sua-tam/c4.html
            const staffs = await staffModel.getBy(conds, sorts, page, item_per_page);

            const allStaffs = await staffModel.getBy(conds, sorts);

            const totalPage = Math.ceil(allStaffs.length / item_per_page); //để phân trag

            for (let i = 0; i <= staffs.length - 1; i++) {
                staffs[i].role = await staffs[i].getRole();
            }

            res.render('admin/staff/index', {
                staffs: staffs,
                totalPage: totalPage,
                page: page,
                layout: 'admin/layout',
                search: search
            });
        } catch (error) {
            res.status(500).send(error.message);
        }
    }


    static create = async (req, res) => {
        try {
            const roles = await roleModel.all();
            res.render('admin/staff/create', {
                layout: 'admin/layout',
                roles: roles
            });
        } catch (error) {
            res.status(500).send(error.message);
        }
    }

    static store = async (req, res) => {
        try {
            await staffModel.save(req.body);

            req.session.message_success = `Tạo nhân viên ${req.body.name} thành công.`;
            req.session.save(() => {
                res.redirect('/admin/staff');
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static edit = async (req, res) => {
        try {
            const staff = await staffModel.find(req.params.id);
            const roles = await roleModel.all();
            res.render('admin/staff/edit', {
                layout: 'admin/layout',
                staff: staff,
                roles: roles
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static update = async (req, res) => {
        try {
            const id = req.body.id;
            await staffModel.update(id, {
                name: req.body.name,
                role_id: req.body.role_id,
                mobile: req.body.mobile,
                email: req.body.email,
                username: req.body.username,
                is_active: req.body.is_active
            });
            // Update session message for success
            req.session.message_success = `Sửa thông tin nhân viên ${req.body.name} thành công!`;
            req.session.save(() => {
                res.redirect('/admin/staff');
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static destroy = async (req, res) => {
        try {
            const id = req.params.id;
            const staff = await staffModel.find(req.params.id);
            await staffModel.destroy(id);
            req.session.message_success = `Xóa nhân viên ${staff.name} thành công!`;
            req.session.save(() => {
                res.redirect('/admin/staff');
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
module.exports = AdminStaffController;