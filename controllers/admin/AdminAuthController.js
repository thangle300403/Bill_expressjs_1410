const { response } = require('express');
const staffsModel = require('../../models/Staff');
const bcrypt = require('bcrypt');
class AdminAuthController {
    // hiển thị trang liên hệ
    static login = async (req, res) => {
        // trycatch
        try {
            res.render('admin/auth/login', {
                layout: false
            });
        } catch (error) {
            // 500 là lỗi internal server (lỗi xãy ra ở server)
            console.log(error);//dành cho dev xem
            res.status(500).send(error.message);//cho người dùng xem
        }
    }

    static processLogin = async (req, res) => {
        const { email, password } = req.body;
        // 1. Tìm email
        const staff = await staffsModel.findEmail(email);
        if (!staff) {
            req.session.message_error = 'Email không tồn tại';
            req.session.save(() => res.redirect('/admin/login.html'));
            return;
        }

        // 2. Kiểm tra mật khẩu đúng không
        if (!bcrypt.compareSync(password, staff.password)) {
            req.session.message_error = `Lỗi: Mật khẩu không đúng, vui lòng nhập lại`;
            req.session.save(() => res.redirect('/admin/login.html'));
            return;
        }

        req.session.staff_email = staff.email;
        req.session.staff_name = staff.name;
        req.session.staff_role_id = staff.role_id;

        req.session.save(() => res.redirect('/admin'));
    }

    // logout
    static logout = async (req, res) => {
        try {
            req.session.destroy(() => {
                res.redirect('/admin/login');
            })
        } catch (error) {
            console.log(error);//dành cho dev xem
            res.status(500).send(error.message);//cho người dùng xem
        };
    }

    // neu login roi thi tra ve {isLogin: true}
    static checkLogin = async (req, res) => {
        try {
            if (req.session.email) {
                res.json({ isLogin: true });
            } else {
                res.json({ isLogin: false });
            }
        } catch (error) {
            console.log(error);//dựa cho dev xem
            res.status(500).send(error.message);//cho người dùng xem
        };
    }
}

module.exports = AdminAuthController;