const customerModel = require('../../models/Customer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const wardModel = require('../../models/Ward')
const districtModel = require('../../models/District')
const JWT_SECRET = process.env.JWT_KEY;

class ApiAuthController {
    static login = async (req, res) => {
        try {
            const { email, password } = req.body;

            const customer = await customerModel.findEmail(email);

            if (!customer) {
                return res.status(400).json({ message: `Email ${email} không tồn tại.` });
            }

            const match = bcrypt.compareSync(password, customer.password);
            if (!match) {
                return res.status(401).json({ message: 'Mật khẩu không đúng.' });
            }

            if (!customer.is_active) {
                return res.status(403).json({ message: 'Tài khoản chưa được kích hoạt.' });
            }

            // ✅ Generate JWT token
            const token = jwt.sign(
                {
                    id: customer.id,
                    email: customer.email,
                    name: customer.name,
                },
                JWT_SECRET,
                { expiresIn: '30d' }
            );

            console.log("✅ JWT token:", token);

            const fullCustomer = await customerModel.getById(customer.id); // more complete info

            // Get province, district by ward
            let districtId = null;
            let provinceId = null;

            if (fullCustomer.ward_id) {
                const ward = await wardModel.find(fullCustomer.ward_id);
                if (ward) {
                    districtId = ward.district_id;
                    const district = await districtModel.find(districtId);
                    if (district) {
                        provinceId = district.province_id;
                    }
                }
            }

            // Add to final response
            fullCustomer.district_id = districtId;
            fullCustomer.province_id = provinceId;

            const { password: _ignored, ...rest } = fullCustomer;

            // ✅ Respond with token & user info
            const responsePayload = {
                access_token: token,
                user: rest,
                message: 'Đăng nhập thành công.',
            };

            res.json(responsePayload);
        } catch (error) {
            console.error("Login error:", error);
            res.status(500).json({ message: error.message });
        }
    };

    static checkLogin = async (req, res) => {
        try {
            const authHeader = req.headers.authorization;

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ message: 'Không có token xác thực.' });
            }

            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET);

            res.json({
                isLogin: true,
                user: {
                    id: decoded.id,
                    email: decoded.email,
                    name: decoded.name,
                }
            });
        } catch (error) {
            res.status(401).json({ isLogin: false, message: 'Token không hợp lệ hoặc hết hạn.' });
        }
    };
}

module.exports = ApiAuthController;
