const Cart = require('../models/Cart')
const customerModel = require('../models/Customer');
const provinceModel = require('../models/Province');
const districtModel = require('../models/District');
const wardModel = require('../models/Ward');
const transportModel = require('../models/Transport');
const orderModel = require('../models/Order');
const orderItemModel = require('../models/OrderItem');
class PaymentController {
    static checkout = async (req, res) => {
        try {
            if (!req.session.email) {
                req.session.message_error = 'Vui lòng đăng nhập để thực hiện chức năng này!';
                req.session.save(() => res.redirect('/'));
                return;
            }
            const cart = new Cart(req.cookies.cart);
            // support 2 trường hợp, đã login và chưa login
            const email = req.session.email;
            const customer = await customerModel.findEmail(email);
            const provinces = await provinceModel.all();
            const selected_ward_id = customer.ward_id;
            // Cần danh sách quận huyện và phường xã, danh tỉnh thành đã có ở trên
            let districts = [];
            let wards = [];
            let selected_district_id = '';
            let selected_province_id = '';
            let shipping_fee = 0;
            if (selected_ward_id) {
                const selected_ward = await wardModel.find(selected_ward_id);
                selected_district_id = selected_ward.district_id;
                wards = await wardModel.getByDistrictId(selected_district_id);

                const selected_district = await districtModel.find(selected_district_id);
                selected_province_id = selected_district.province_id;
                districts = await districtModel.getByProvinceId(selected_province_id);

                // Tìm phí giao hàng dựa vào mã tỉnh thành
                const transportModel = require('../models/Transport');
                const transport = await transportModel.getByProvinceId_checkout(selected_province_id);
                shipping_fee = transport.price;
            }

            res.render('payment/checkout', {
                cart: cart,
                shipping_fee: shipping_fee,
                customer: customer,
                provinces: provinces,
                districts: districts,
                wards: wards,
                selected_ward_id: selected_ward_id,
                selected_district_id: selected_district_id,
                selected_province_id: selected_province_id
            });
        } catch (error) {
            res.status(500).send(error.message);
        }
    }

    // Xử lý đơn hàng
    static order = async (req, res) => {
        try {
            const cart = new Cart(req.cookies.cart);

            const email = req.session.email;
            const customer = await customerModel.findEmail(email);

            const transportModel = require('../models/Transport');
            const transport = await transportModel.getByProvinceId(req.body.province);

            if (!transport) {
                req.session.message_error = 'Không tìm thấy thông tin phí giao hàng.';
                return res.redirect('/gio-hang.html');
            }
            const shipping_fee = transport.price;

            const data = {
                created_date: req.app.locals.helpers.getCurrentDateTime(),
                order_status_id: 1,
                staff_id: null,
                customer_id: customer.id,
                shipping_fullname: req.body.fullname,
                shipping_mobile: req.body.mobile,
                payment_method: req.body.payment_method,
                shipping_ward_id: req.body.ward,
                shipping_housenumber_street: req.body.address,
                shipping_fee: shipping_fee,
                delivered_date: req.app.locals.helpers.getThreeLaterDateTime(),
            };

            const orderId = await orderModel.save(data);

            for (const product_id in cart.items) {
                const item = cart.items[product_id];
                const data = {
                    product_id: product_id,
                    order_id: orderId,
                    qty: item.qty,
                    unit_price: item.unit_price,
                    total_price: item.total_price,
                };
                await orderItemModel.save(data);
            }

            const emptyCart = new Cart();
            const stringCart = emptyCart.toString();
            res.cookie('cart', stringCart, {
                maxAge: 3600000,
                httpOnly: false,
            });

            req.session.message_success = 'Đơn hàng đã được tạo thành công';
            req.session.save(() => res.redirect('/don-hang-cua-toi.html'));
        } catch (error) {
            console.error('Error processing order:', error);
            res.status(500).send(error.message);
        }
    };

}
module.exports = PaymentController;