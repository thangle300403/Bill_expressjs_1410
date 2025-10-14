

const express = require('express');
const router = express.Router();
const HomeController = require('../controllers/HomeController');
const ProductController = require('../controllers/ProductController');
const InformationController = require('../controllers/InformationController');
const ContactController = require('../controllers/ContactController');
const AuthController = require('../controllers/AuthController');
const CustomerController = require('../controllers/CustomerController.js');
const CartController = require('../controllers/CartController.js');
const PaymentController = require('../controllers/PaymentController.js');
const AddressController = require('../controllers/AddressController.js');
const ChatbotController = require('../controllers/ChatBotController.js');
const VRController = require('../controllers/VRController.js');
const Recaptcha = require('express-recaptcha').RecaptchaV2

//get
router.get('/address/districts', AddressController.districts);
router.get('/address/wards', AddressController.wards);
router.get('/checkLogin', AuthController.checkLogin);
router.get('/logout', AuthController.logout);
router.get('/cart/add', CartController.add);
router.get('/address/shippingfee', CartController.delete);
router.get('/cart/delete', CartController.delete);
router.get('/cart/get', CartController.get);
router.get('/cart/update', CartController.update);
router.get('/chat-bot.html', ChatbotController.form);
router.get('/lien-he.html', ContactController.form); //contact
router.get('/customer/active/token/:token', CustomerController.active);
router.get('/customer/notexisting', CustomerController.notexisting);
router.get('/chi-tiet-don-hang-:id.html', CustomerController.orderDetail);
router.get('/don-hang-cua-toi.html', CustomerController.orders);
router.get('/customer/resetpassword/token/:token', CustomerController.resetpassword);
router.get('/dia-chi-giao-hang-mac-dinh.html', CustomerController.shippingDefault);
router.get('/thong-tin-tai-khoan.html', CustomerController.show);
router.get('/', HomeController.index);
router.get('/chinh-sach-doi-tra.html', InformationController.returnPolicy); //returnPolicy
router.get('/chinh-sach-giao-hang.html', InformationController.deliveryPolicy); //deliveryPolicy
router.get('/chinh-sach-thanh-toan.html', InformationController.paymentPolicy); //paymentPolicy
router.get('/dat-hang.html', PaymentController.checkout);
router.get('/danh-muc/:slug/c:category_id.html', ProductController.index); //danh-muc/sua-tam/c3.html
router.get('/san-pham.html', ProductController.index);
router.get('/san-pham/:slug.html', ProductController.detail); //danh-muc/sua-tam/c3.html
router.get('/search', ProductController.index); //search
router.get('/trai-nghiem-ao.html', VRController.index);

//post
router.post('/login', AuthController.login); //login
router.post('/contact/sendEmail', ContactController.sendEmail); //send email
router.post('/chatbot-response', ChatbotController.getResponse);
router.post('/forgotpassword', CustomerController.forgotpassword);
const recaptcha = new Recaptcha(process.env.GOOGLE_RECAPTCHA_SITE, process.env.GOOGLE_RECAPTCHA_SECRET); // import Recaptcha from 'express-recaptcha'
router.post('/register', recaptcha.middleware.verify, CustomerController.register);
router.post('/thong-tin-tai-khoan.html', CustomerController.updateInfo);
router.post('/customer/updateShippingDefault', CustomerController.updateShippingDefault);
router.post('/customer/updatePassword', CustomerController.updatePassword);
router.post('/thanh-toan.html', PaymentController.order);
router.post('/comments', ProductController.storeComment); //lưu đánh giá

module.exports = router;