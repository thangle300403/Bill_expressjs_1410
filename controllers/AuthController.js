const { response } = require('express');
const customerModel = require('../models/Customer');
const bcrypt = require('bcrypt');
class AuthController {
    // hiển thị trang liên hệ
    static login = async (req, res) => {
        // trycatch
        try {
            // Kiểm tra email có tồn tại trong hệ thống không
            const email = req.body.email;
            const customer = await customerModel.findEmail(email);
            if (!customer) {
                req.session.message_error = `Lỗi: không tồn tại ${email} trong hệ thống`;
                // về trang chủ
                req.session.save(() => {
                    res.redirect('/');
                });
                return;
            }

            // Kiểm tra mật khẩu
            const password = req.body.password
            // password chưa mã hóa 
            // customer.password password đã mã hóa
            const match = bcrypt.compareSync(password, customer.password);
            console.log(password, customer.password);

            if (!match) {
                req.session.message_error = `Lỗi: mật khẩu không đúng`;
                // req.app.locals.session.message_error = `Lỗi: mật khẩu không đúng`;
                // về trang chủ
                req.session.save(() => {
                    res.redirect('/');
                });
                return;
            }

            // kiểm tra customer đã active chưa?
            if (!customer.is_active) {
                req.session.message_error = `Lỗi: tài khoản chưa được kích hoạt`;
                // về trang chủ
                req.session.save(() => {
                    res.redirect('/');
                });
                return;
            }

            // login thành công
            req.session.name = customer.name;
            req.session.email = customer.email;

            // req.session.message_success = 'Đã đăng nhập thành công';
            // về trang chủ
            // lưu session xuống file trước khi redirect
            req.session.save(() => {
                res.redirect('/thong-tin-tai-khoan.html');
            })
        } catch (error) {
            // 500 là lỗi internal server (lỗi xãy ra ở server)
            console.log(error);//dành cho dev xem
            res.status(500).send(error.message);//cho người dùng xem
        }

    }

    // logout
    static logout = async (req, res) => {
        try {
            req.session.destroy(() => {
                res.redirect('/');
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

module.exports = AuthController;