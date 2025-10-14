const customerModel = require('../../models/Customer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_KEY;

class ApiRegisterController {
  static register = async (req, res) => {
    try {
      const { fullname, email, password, mobile } = req.body;

      // 1. Check if email already exists
      const existing = await customerModel.findEmail(email);
      if (existing) {
        return res.status(409).json({
          message: `Email ${email} đã tồn tại trong hệ thống.`
        });
      }

      // 2. Hash password
      const hashedPassword = bcrypt.hashSync(password, 10);

      // 3. Save new user to DB
      const data = {
        name: fullname,
        email,
        password: hashedPassword,
        mobile,
        shipping_name: fullname,
        shipping_mobile: mobile,
        login_by: 'form',
        is_active: 0,
      };

      await customerModel.save(data);

      // 4. Send activation email
      const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '3d' });
      const web = process.env.FRONTEND_URL;
      const link = `${web}/active_account?token=${token}`;

      const subject = 'Godashop - Verify your email.';
      const content = `
            <!DOCTYPE html>
            <html lang="vi">
              <head>
                <meta charset="UTF-8" />
                <title>Kích hoạt tài khoản</title>
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
                    <div class="brutalist-card__alert">Kích hoạt tài khoản</div>
                  </div>
                  <div class="brutalist-card__message">
                    Xin chào ${email},<br>
                    Click vào nút bên dưới để kích hoạt tài khoản.<br><br>
                    Được gửi từ web <a href="${web}">${web}</a>
                  </div>
                  <div class="brutalist-card__actions">
                    <a class="brutalist-card__button brutalist-card__button--mark" href="${link}">
                      Kích hoạt tài khoản
                    </a>
                  </div>
                </div>
              </body>
            </html>
            `;

      await req.app.locals.helpers.sendEmail(email, subject, content);

      return res.status(201).json({
        message: `Đã đăng ký tài khoản thành công. Vui lòng kiểm tra ${email} để kích hoạt tài khoản.`,
      });
    } catch (error) {
      console.error('Registration error:', error.message);
      return res.status(500).json({
        message: 'Đã xảy ra lỗi khi đăng ký tài khoản.',
      });
    }
  };

  static notexisting = async (req, res) => {
    try {
      const email = req.params.email;
      const customer = await customerModel.findEmail(email);
      res.send(!customer);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };
}



module.exports = ApiRegisterController;
