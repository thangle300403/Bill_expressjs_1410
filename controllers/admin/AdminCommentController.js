const session = require('express-session');
const commentModel = require('../../models/Comment');
const chatbotAdminModel = require("../../models/ChatbotAdmin");

class AdminCommentController {
    //trả về view -> (req, res)
    static index = async (req, res) => {
        try {
            const page = req.query.page || 1;
            const item_per_page = process.env.PRODUCT_ITEM_PER_PAGE;
            let conds = {};
            let sorts = {};

            const search = req.query.search;
            if (search) {
                conds.description = {
                    type: 'LIKE',
                    val: `'%${search}%'`
                }
                //select * from view_comment where name like '%kem%'
            }
            // /danh-muc/sua-tam/c4.html
            const comments = await commentModel.getBy(conds, sorts, page, item_per_page);

            const allComments = await commentModel.getBy(conds, sorts);

            const totalPage = Math.ceil(allComments.length / item_per_page); //để phân trag

            res.render('admin/comment/index', {
                comments: comments,
                totalPage: totalPage,
                page: page,
                layout: 'admin/layout',
                search: search
            });
        } catch (error) {
            res.status(500).send(error.message);
        }
    }

    static destroy = async (req, res) => {
        try {
            const id = req.params.id;
            const comment = await commentModel.find(req.params.id);
            await commentModel.destroy(id);
            req.session.message_success = `Xóa bình luận của khách hàng ${comment.fullname} thành công!`;
            req.session.save(() => {
                res.redirect('/admin/comment');
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }
}
module.exports = AdminCommentController;