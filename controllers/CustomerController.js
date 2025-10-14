const customerModel = require('../models/Customer');
const orderModel = require('../models/Order');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const provinceModel = require('../models/Province');
const districtModel = require('../models/District');
const wardModel = require('../models/Ward');
class CustomerController {

    // thông tin tài khoản
    static show = async (req, res) => {
        // trycatch
        try {
            const customer = await customerModel.findEmail(req.session.email);
            res.render('customer/show', {
                customer: customer
            });

        } catch (error) {
            // 500 là lỗi internal server (lỗi xãy ra ở server)
            console.log(error);//dành cho dev xem
            res.status(500).send(error.message);//cho người dùng xem
        }

    }

    // địa chỉ giao hàng mặc định
    static shippingDefault = async (req, res) => {
        // trycatch
        try {
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
            if (selected_ward_id) {
                const selected_ward = await wardModel.find(selected_ward_id);
                selected_district_id = selected_ward.district_id;
                wards = await wardModel.getByDistrictId(selected_district_id);

                const selected_district = await districtModel.find(selected_district_id);
                selected_province_id = selected_district.province_id;
                districts = await districtModel.getByProvinceId(selected_province_id);
            }
            res.render('customer/shippingDefault', {
                customer: customer,
                provinces: provinces,
                districts: districts,
                wards: wards,
                selected_ward_id: selected_ward_id,
                selected_district_id: selected_district_id,
                selected_province_id: selected_province_id
            });
        } catch (error) {
            // 500 là lỗi internal server (lỗi xãy ra ở server)
            console.log(error);//dành cho dev xem
            res.status(500).send(error.message);//cho người dùng xem
        }
    }

    // đơn hàng của tôi
    static orders = async (req, res) => {
        // trycatch
        try {
            const email = req.session.email;
            const customer = await customerModel.findEmail(email);
            const customer_id = customer.id;
            const orders = await orderModel.getByCustomerId(customer_id);
            for (let i = 0; i <= orders.length - 1; i++) {
                //tự thêm orderItems
                orders[i].orderItems = await orders[i].getOrderItems();
                for (let j = 0; j <= orders[i].orderItems.length - 1; j++) {
                    orders[i].orderItems[j].product = await orders[i].orderItems[j].getProduct();
                }
                orders[i].status = await orders[i].getStatus();
            }
            res.render('customer/orders', {
                orders: orders
            });
        } catch (error) {
            // 500 là lỗi internal server (lỗi xãy ra ở server)
            console.log(error);//dành cho dev xem
            res.status(500).send(error.message);//cho người dùng xem
        }
    }

    // chi tiết đơn hàng
    static orderDetail = async (req, res) => {
        // trycatch
        try {
            const id = req.params.id;
            const order = await orderModel.find(id);
            order.orderItems = await order.getOrderItems();
            for (let i = 0; i <= order.orderItems.length - 1; i++) {
                order.orderItems[i].product = await order.orderItems[i].getProduct();
            }
            order.total_price = await order.getSubTotalPrice();
            const shippingWard = await order.getShippingWard();
            const shippingDistrict = await shippingWard.getDistrict();
            const shippingProvince = await shippingDistrict.getProvince();
            res.render('customer/orderDetail', {
                order: order,
                shippingWard: shippingWard,
                shippingDistrict: shippingDistrict,
                shippingProvince: shippingProvince,
            });
        } catch (error) {
            // 500 là lỗi internal server (lỗi xãy ra ở server)
            console.log(error);//dành cho dev xem
            res.status(500).send(error.message);//cho người dùng xem
        }
    }

    // cập nhật thông tin tài khoản
    static updateInfo = async (req, res) => {
        try {
            const customer = await customerModel.findEmail(req.session.email);

            // Update fields
            customer.name = req.body.fullname || customer.name;
            customer.mobile = req.body.mobile || customer.mobile;

            if (req.body.current_password && req.body.password) {
                if (!bcrypt.compareSync(req.body.current_password, customer.password)) {
                    req.session.message_error = 'Lỗi: Sai mật khẩu';
                    req.session.save(() => res.redirect('/thong-tin-tai-khoan.html'));
                    return;
                }

                // Hash the new password
                const saltRounds = 10;
                const salt = bcrypt.genSaltSync(saltRounds);
                customer.password = bcrypt.hashSync(req.body.password, salt);
            }

            // Prepare update data
            const updateData = {
                name: customer.name,
                mobile: customer.mobile,
                password: customer.password || null, // Include only if updated
            };
            // Update in database
            await customer.update(customer.id, updateData);

            // Update session and redirect
            req.session.message_success = 'Đã cập nhật thông tin tài khoản thành công';
            req.session.name = req.body.fullname; // Update session name
            req.session.save(() => res.redirect('/thong-tin-tai-khoan.html'));
        } catch (error) {
            console.error('Error updating customer info:', error.message);
            res.status(500).send(error.message); // Send error to user
        }
    };

    static updateShippingDefault = async (req, res) => {
        try {
            const email = req.session.email;
            const customer = await customerModel.findEmail(email);

            // Assign fields, handling undefined values
            customer.shipping_name = req.body.fullname || null;
            customer.shipping_mobile = req.body.mobile || null;
            customer.housenumber_street = req.body.address || null;
            customer.ward_id = req.body.ward || null;

            // Prepare sanitized data for update
            const sanitizedData = {
                shipping_name: customer.shipping_name,
                shipping_mobile: customer.shipping_mobile,
                housenumber_street: customer.housenumber_street,
                ward_id: customer.ward_id,
            };

            // Check if there are any valid fields to update
            const hasValidFields = Object.values(sanitizedData).some((value) => value !== null);
            if (!hasValidFields) {
                throw new Error('No fields to update. Ensure the data object contains valid fields.');
            }

            // Perform the update
            await customer.update(customer.id, sanitizedData);

            req.session.message_success = 'Đã cập nhật địa chỉ giao hàng mặc định thành công';
            req.session.save(() => res.redirect('/dia-chi-giao-hang-mac-dinh.html'));
        } catch (error) {
            console.error('Error updating shipping default:', error.message);
            req.session.message_error = 'Đã xảy ra lỗi khi cập nhật địa chỉ.';
            res.redirect('/dia-chi-giao-hang-mac-dinh.html');
        }
    };

    // trả về true nếu không tồn tại email
    // trả về false nếu tồn tại email
    static notexisting = async (req, res) => {
        try {
            const email = req.query.email;
            const customer = await customerModel.findEmail(email);
            if (customer) {
                res.end('false');
                return;
            }
            res.end('true');
        }
        catch (error) {
            // 500 là lỗi internal server (lỗi xãy ra ở server)
            console.log(error);//dành cho dev xem
            res.status(500).send(error.message);//cho người dùng xem
        }
    }

    // đăng ký tạo tài khoản mới
    static register = async (req, res) => {
        try {
            if (req.recaptcha.error) {
                req.session.message_error = `Lỗi: ${req.recaptcha.error}`;
                req.session.save(() => {
                    res.redirect('/');
                });
                return;
            }

            // kiểm tra email có tồn tại trong hệ thống không
            const email = req.body.email;
            const customer = await customerModel.findEmail(email);
            if (customer) {
                req.session.message_error = `Lỗi: ${email} đã tồn tại trong hệ thống`;
                req.session.save(() => {
                    res.redirect('/');
                });
                return;
            }

            const saltRounds = 10;
            const salt = bcrypt.genSaltSync(saltRounds);
            const encode_password = bcrypt.hashSync(req.body.password, salt);

            const data = {
                name: req.body.fullname,
                email: req.body.email,
                password: encode_password,
                mobile: req.body.mobile,
                shipping_name: req.body.fullname,
                shipping_mobile: req.body.mobile,
                login_by: 'form',
                is_active: 0,
            }
            await customerModel.save(data);

            const to = email;
            const subject = 'Godashop - Verify your email.'
            const web = `${req.protocol}://${req.headers.host}`;
            const privateKey = process.env.JWT_KEY;
            const token = jwt.sign({ email: to }, privateKey, { algorithm: 'HS256' });
            const linkActiveAccount = `${web}/customer/active/token/${token}`;
            const content = `
            Xin chào ${email}, <br>
            Xin vui lòng click vào link bên dưới để kích hoạt tài khoản, <br>
            <a href = "${linkActiveAccount}"> Active Account</a><br>
            Được gởi từ web ${web}.
            `;

            await req.app.locals.helpers.sendEmail(to, subject, content);
            req.session.message_success = `Đã tạo tài khoản thành công, vui lòng vào ${email} để kích hoạt tài khoản.`;
            req.session.save(() => {
                res.redirect('/');
            })
        } catch (error) {
            // 500 là lỗi internal server (lỗi xãy ra ở server)
            console.log(error);//dành cho dev xem
            res.status(500).send(error.message);//cho người dùng xem
        }
    }

    // kích hoạt tài khoản
    static active = async (req, res) => {
        try {
            const token = req.params.token;
            const privateKey = process.env.JWT_KEY;

            // Decode the JWT token
            const decoded = jwt.verify(token, privateKey);
            const email = decoded.email;

            // Fetch the customer by email
            const customer = await customerModel.findEmail(email);

            // Update the `is_active` field to activate the account
            const data = { is_active: 1 }; // Prepare the data object
            await customer.update(customer.id, data); // Pass the ID and data object to the update method

            // Set success message and redirect
            req.session.message_success = `Đã kích hoạt tài khoản thành công`;
            req.session.save(() => {
                res.redirect('/');
            });
        } catch (error) {
            // Log and handle the error
            console.error('Error activating account:', error.message);
            res.status(500).send(error.message);
        }
    };

    static forgotpassword = async (req, res) => {
        try {
            const email = req.body.email;
            const to = email;
            const subject = 'Godashop - Reset password'
            const web = `${req.protocol}://${req.headers.host}`;
            const privateKey = process.env.JWT_KEY;
            const token = jwt.sign({ email: to }, privateKey, { algorithm: 'HS256' });
            const linkActiveAccount = `${web}/customer/resetpassword/token/${token}`;
            const content = `
            Xin chào ${email}, <br>
            Xin vui lòng click vào link bên dưới để tạo mới mật khẩu, <br>
            <a href = "${linkActiveAccount}">Reset Password</a><br>
            Được gởi từ web ${web}.
            `;
            req.app.locals.helpers.sendEmail(to, subject, content);
            req.session.message_success = `Vui lòng kiểm tra ${email} để tạo mới mật khẩu.`;
            req.session.save(() => {
                res.redirect('/');
            });
        }
        catch (error) {
            // 500 là lỗi internal server (lỗi xãy ra ở server)
            console.log(error);//dành cho dev xem
            res.status(500).send(error.message);//cho người dùng xem
        }
    }

    static resetpassword = async (req, res) => {
        try {
            const token = req.params.token;
            const privateKey = process.env.JWT_KEY;
            const decoded = jwt.verify(token, privateKey);
            const email = decoded.email;
            res.render('customer/forgotpassword', {
                email: email,
                token: token,
            })
        }
        catch (error) {
            // 500 là lỗi internal server (lỗi xãy ra ở server)
            console.log(error);//dành cho dev xem
            res.status(500).send(error.message);//cho người dùng xem
        }
    }

    static updatePassword = async (req, res) => {
        try {
            const token = req.body.token;
            const privateKey = process.env.JWT_KEY;

            // Decode the JWT token
            const decoded = jwt.verify(token, privateKey);
            const email = decoded.email;

            // Fetch the customer by email
            const customer = await customerModel.findEmail(email);

            // Hash the new password
            const saltRounds = 10;
            const salt = bcrypt.genSaltSync(saltRounds);
            const hash = bcrypt.hashSync(req.body.password, salt);

            // Update the customer's password
            const data = { password: hash }; // Prepare the data object
            await customer.update(customer.id, data); // Pass the ID and data object to the update method

            // Success message
            req.session.message_success = `Đã tạo mới mật khẩu thành công.`;
            req.session.save(() => {
                res.redirect('/');
            });
        } catch (error) {
            // Log and handle the error
            console.error('Error updating password:', error.message);
            res.status(500).send(error.message);
        }
    };

}

module.exports = CustomerController;