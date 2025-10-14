const Cart = require('../models/Cart');
class CartController {
    // Hàm hiển thị danh sách sinh viên
    static add = async (req, res) => {
        try {
            const cart = new Cart(req.cookies.cart);
            const product_id = req.query.product_id;
            const qty = req.query.qty;
            await cart.addProduct(product_id, qty)
            const stringCart = cart.toString();
            res.cookie('cart', stringCart, {
                // đơn vị miligiay (60 x 60 x 1000)
                maxAge: 3600000, // Thời gian sống của cookie (1 giờ)
                httpOnly: false, // false nghĩa là truy cập được ở client và server. Còn true nghĩa là chỉ truy cập ở phía server
            });
            res.end();
        } catch (error) {
            res.status(500).send(error.message);
        }
    }

    static update = async (req, res) => {
        try {
            const cart = new Cart(req.cookies.cart);
            const product_id = req.query.product_id;
            const qty = req.query.qty;
            cart.deleteProduct(product_id);
            await cart.addProduct(product_id, qty);
            const stringCart = cart.toString();
            res.cookie('cart', stringCart, {
                // đơn vị miligiay (60 x 60 x 1000)
                maxAge: 3600000, // Thời gian sống của cookie (1 giờ)
                httpOnly: false, // false nghĩa là truy cập được ở client và server. Còn true nghĩa là chỉ truy cập ở phía server
            });
            res.end();
        } catch (error) {
            res.status(500).send(error.message);
        }
    }

    static delete = (req, res) => {
        try {
            const cart = new Cart(req.cookies.cart);

            const product_id = req.query.product_id;
            cart.deleteProduct(product_id);
            const stringCart = cart.toString();
            res.cookie('cart', stringCart, {
                // đơn vị miligiay (60 x 60 x 1000)
                maxAge: 3600000, // Thời gian sống của cookie (1 giờ)
                httpOnly: false, // false nghĩa là truy cập được ở client và server. Còn true nghĩa là chỉ truy cập ở phía server
            });
            res.end();
        } catch (error) {
            res.status(500).send(error.message);
        }
    }
    // hok sài
    static get = async (req, res) => {
        try {
            res.end('Đã lấy được cookie');
        } catch (error) {
            res.status(500).send(error.message);
        }
    }

}

module.exports = CartController;