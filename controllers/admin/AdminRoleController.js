const session = require('express-session');
const roleModel = require('../../models/Role');
const staffModel = require('../../models/Staff');
const actionModel = require('../../models/Action');
const roleActionModel = require('../../models/RoleAction');

class AdminRoleController {
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

            const search_action = req.query.search_action;
            let actions = [];

            if (search_action) {
                actions = await roleActionModel.searchByAction(search_action);
            } else {
                // Handle case where no search term is provided
                actions = await roleActionModel.getBy();
            }

            // /danh-muc/sua-tam/c4.html
            const roles = await roleModel.getBy(conds, sorts, page, item_per_page);

            const allRoles = await roleModel.getBy(conds, sorts);

            const allActions = await actionModel.getBy(conds, sorts);

            const roleActions = await roleActionModel.getBy();

            // Map role_id to an array of action_ids
            const roleActionMap = roleActions.reduce((map, roleAction) => {
                if (!map[roleAction.role_id]) {
                    map[roleAction.role_id] = [];
                }
                map[roleAction.role_id].push(roleAction.action_id);
                return map;
            }, {});

            const totalPage = Math.ceil(allRoles.length / item_per_page); //để phân trag

            res.render('admin/role/index', {
                allActions: allActions,
                roles: roles,
                totalPage: totalPage,
                page: page,
                layout: 'admin/layout',
                search: search,
                search_action: search_action,
                roleActionMap: roleActionMap
            });
        } catch (error) {
            console.log(error);
            res.status(500).send(error.message);
        }
    }


    static create = (req, res) => {
        try {
            res.render('admin/role/create', {
                layout: 'admin/layout',
            });
        } catch (error) {
            res.status(500).send(error.message);
        }
    }

    static store = async (req, res) => {
        try {
            roleModel.save(req.body);
            req.session.message_success = `Tạo vai trò ${req.body.name} thành công!`;
            req.session.save(() => {
                res.redirect('/admin/role');
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static edit = async (req, res) => {
        try {
            const role = await roleModel.find(req.params.id);
            res.render('admin/role/edit', {
                role: role,
                layout: 'admin/layout',
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static update = async (req, res) => {
        try {
            const id = req.body.id;
            await roleModel.update(id, {
                name: req.body.name,
            });
            // Update session message for success
            req.session.message_success = `Sửa cai trò ${req.body.name} thành công!`;
            req.session.save(() => {
                res.redirect('/admin/role');
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static updateRole = async (req, res) => {
        try {
            const roles = await roleModel.all();
            const roleId = req.body.roleId; // Get the role ID 
            let actionIds = req.body['permissions[]']; // Get the permissions array

            // Ensure actionIds is an array and remove duplicates
            if (!Array.isArray(actionIds)) {
                actionIds = [actionIds]; // Convert to array if it's a single item
            }
            actionIds = [...new Set(actionIds)]; // Remove duplicates

            // Destroy existing permissions for the role
            await roleActionModel.destroyByRoleId(roleId);

            // Insert new permissions
            for (const actionId of actionIds) {
                await roleActionModel.save({ role_id: roleId, action_id: actionId });
            }
            return res.status(200).json({ success: true, message: `Cập nhật quyền cho vai trò ${roles.find(role => role.id == roleId).name} thành công!` });
            // Success message
        } catch (error) {
            console.error('Error updating role:', error.message);
            return res.status(500).json({ success: false, message: 'Failed to update role permissions' });
        }
    }



    static destroy = async (req, res) => {
        try {
            const id = req.params.id;
            const role = await roleModel.find(req.params.id);
            const staffs = await staffModel.findByRole(id);
            if (staffs.length) {
                req.session.message_error = `Không thể xóa vai trò ${role.name} vì có ${staffs.length} nhân viên đang giữ vai trò này!`;
                req.session.save(() => {
                    res.redirect('/admin/role');
                });
            } else {
                await roleActionModel.destroyByRoleId(id);
                await roleModel.destroy(id);
                req.session.message_success = `Xóa vai trò ${role.name} thành công!`;
                req.session.save(() => {
                    res.redirect('/admin/role');
                });

            }
        } catch (error) {
            throw new Error(error.message);
        }
    }

}
module.exports = AdminRoleController;