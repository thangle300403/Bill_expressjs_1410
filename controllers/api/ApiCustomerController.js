const customerModel = require('../../models/Customer');
const wardModel = require('../../models/Ward')
const districtModel = require('../../models/District')
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

class ApiCustomerController {
    static updateShippingDefault = async (req, res) => {
        try {
            const customerId = req.params.id;

            const customer = await customerModel.getById(customerId);
            if (!customer) {
                console.log('customer', customerId);
                return res.status(404).json({ message: 'Customer not found' });
            }

            const updatedFields = {
                shipping_name: req.body.fullname,
                shipping_mobile: req.body.mobile,
                housenumber_street: req.body.address,
                ward_id: req.body.ward,
            };

            // Remove undefineds
            for (const key in updatedFields) {
                if (updatedFields[key] === undefined) updatedFields[key] = null;
            }

            // Update customer in DB
            await customerModel.update(customerId, updatedFields);

            // Get updated customer
            const updatedCustomer = await customerModel.getById(customerId);

            // Enrich with district and province from ward_id
            let districtId = null;
            let provinceId = null;

            if (updatedCustomer.ward_id) {
                const ward = await wardModel.find(updatedCustomer.ward_id);
                if (ward) {
                    districtId = ward.district_id;
                    const district = await districtModel.find(districtId);
                    if (district) {
                        provinceId = district.province_id;
                    }
                }
            }

            // Add to final response
            updatedCustomer.district_id = districtId;
            updatedCustomer.province_id = provinceId;

            res.json(updatedCustomer);
        } catch (error) {
            console.error('❌ updateShippingDefaultAPI error:', error);
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    };

    static updateInfo = async (req, res) => {
        try {
            const token = req.headers.authorization?.split(' ')[1];
            if (!token) {
                return res.status(401).json({ message: 'Access token missing' });
            }

            const decoded = jwt.verify(token, process.env.JWT_KEY);
            const email = decoded.email;

            const customer = await customerModel.findEmail(email);
            if (!customer) {
                return res.status(404).json({ message: 'Customer not found' });
            }

            // Get updates from body
            const { fullname, mobile, current_password, password } = req.body;

            // Update name and mobile
            customer.name = fullname || customer.name;
            customer.mobile = mobile || customer.mobile;

            // Handle password update
            if (current_password && password) {
                const isMatch = bcrypt.compareSync(current_password, customer.password);

                if (!isMatch) {
                    return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng.' });
                }

                const salt = bcrypt.genSaltSync(10);
                customer.password = bcrypt.hashSync(password, salt);
            }

            const updateData = {
                name: customer.name,
                mobile: customer.mobile,
                password: customer.password, // include if changed
            };

            await customer.update(customer.id, updateData);

            // Fetch updated customer
            const updatedCustomer = await customerModel.getById(customer.id);

            res.json(updatedCustomer);
        } catch (error) {
            console.error('❌ updateInfo error:', error);
            res.status(500).json({ message: 'Lỗi server', error: error.message });
        }
    };

    static forgotpassword = async (req, res) => {
        try {
            const email = req.body.email;
            const to = email;
            const subject = 'Godashop - Reset password';
            const web = process.env.FRONTEND_URL;
            const privateKey = process.env.JWT_KEY;

            const token = jwt.sign({ email: to }, privateKey, { algorithm: 'HS256' });
            const link = `${web}/reset_password?token=${token}`;

            const content = `
            <!DOCTYPE html>
            <html lang="vi">
              <head>
                <meta charset="UTF-8" />
                <title>ĐẶT LẠI MẬT KHẨU</title>
                <style>
                  .brutalist-card {
                    width: 320px;
                    border: 4px solid #000;
                    background-color: #fff;
                    padding: 1.5rem;
                    box-shadow: 10px 10px 0 #000;
                    font-family: "Arial", sans-serif;
                  }
            
                  .brutalist-card__header {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    margin-bottom: 1rem;
                    border-bottom: 2px solid #000;
                    padding-bottom: 1rem;
                  }
            
                  .brutalist-card__alert {
                    font-weight: 900;
                    color: #000;
                    font-size: 1.5rem;
                    text-transform: uppercase;
                  }
            
                  .brutalist-card__message {
                    margin-top: 1rem;
                    color: #000;
                    font-size: 0.9rem;
                    line-height: 1.4;
                    border-bottom: 2px solid #000;
                    padding-bottom: 1rem;
                    font-weight: 600;
                  }
            
                  .brutalist-card__actions {
                    margin-top: 1rem;
                  }
            
                  .brutalist-card__button {
                    display: block;
                    width: 100%;
                    padding: 0.75rem;
                    text-align: center;
                    font-size: 1rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    border: 3px solid #000;
                    background-color: #fff;
                    color: #000;
                    position: relative;
                    transition: all 0.2s ease;
                    box-shadow: 5px 5px 0 #000;
                    overflow: hidden;
                    text-decoration: none;
                    margin-bottom: 1rem;
                  }
            
                  .brutalist-card__button--mark:hover {
                    background-color: #296fbb;
                    border-color: #296fbb;
                    color: #fff;
                    box-shadow: 7px 7px 0 #004280;
                  }
                </style>
              </head>
              <body>
                <div class="brutalist-card">
                  <div class="brutalist-card__header">
                    <div class="brutalist-card__alert">Đặt lại mật khẩu</div>
                  </div>
                  <div class="brutalist-card__message">
                    Xin chào ${email},<br>
                    Click vào nút bên dưới để đặt lại mật khẩu.<br><br>
                    Email được gửi từ web <a href="${web}">${web}</a>
                  </div>
                  <div class="brutalist-card__actions">
                    <a class="brutalist-card__button brutalist-card__button--mark" href="${link}">
                      Đặt lại
                    </a>
                  </div>
                </div>
              </body>
            </html>
            `;

            await req.app.locals.helpers.sendEmail(to, subject, content);

            return res.json({
                success: true,
                message: `Vui lòng kiểm tra ${email} để tạo mới mật khẩu.`,
            });
        } catch (error) {
            console.error('❌ Forgot password error:', error);
            return res.status(500).json({
                success: false,
                message: 'Không thể gửi email. Email không tồn tại trong hệ thống.',
                error: error.message
            });
        }
    };

    static updatePassword = async (req, res) => {
        try {
            const token = req.query.token;
            const privateKey = process.env.JWT_KEY;

            // Decode the JWT token
            const decoded = jwt.verify(token, privateKey);
            const email = decoded.email;

            // Fetch the customer by email
            const customer = await customerModel.findEmail(email);
            if (!customer) {
                return res.status(404).json({ success: false, message: "Người dùng không tồn tại." });
            }

            // Hash the new password
            const saltRounds = 10;
            const salt = bcrypt.genSaltSync(saltRounds);
            const hash = bcrypt.hashSync(req.body.password, salt);

            // Update the customer's password
            const data = { password: hash };
            await customer.update(customer.id, data);

            // Respond success
            return res.json({
                success: true,
                message: "Đã tạo mới mật khẩu thành công."
            });
        } catch (error) {
            console.error("Error updating password:", error.message);
            return res.status(500).json({
                success: false,
                message: "Lỗi khi cập nhật mật khẩu.",
                error: error.message
            });
        }
    };
}

module.exports = ApiCustomerController;
