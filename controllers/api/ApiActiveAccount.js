const customerModel = require('../../models/Customer');
const jwt = require('jsonwebtoken');

class ApiActiveAccount {
    // API endpoint to activate account via token
    static active = async (req, res) => {
        try {
            const token = req.query.token;
            const privateKey = process.env.JWT_KEY;

            // Decode token
            const decoded = jwt.verify(token, privateKey);
            const email = decoded.email;

            // Find customer by email
            const customer = await customerModel.findEmail(email);
            if (!customer) {
                return res.status(404).json({ message: "Người dùng không tồn tại." });
            }

            // Update account to active
            const data = { is_active: 1 };
            await customer.update(customer.id, data);

            // Return the user data + success response
            return res.status(200).json({
                message: "Đã kích hoạt tài khoản thành công.",
                user: {
                    id: customer.id,
                    email: customer.email,
                    name: customer.name,
                    access_token: token, // this can be replaced by a fresh token if needed
                },
            });
        } catch (error) {
            console.error("Error activating account:", error.message);
            return res.status(400).json({ message: "Kích hoạt thất bại: " + error.message });
        }
    };
}

module.exports = ApiActiveAccount;
