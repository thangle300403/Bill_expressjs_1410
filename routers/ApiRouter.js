const express = require('express');
const router = express.Router();
const apiCategoryController = require('../controllers/api/ApiCategoryController')
const apiProductController = require('../controllers/api/ApiProductController')
const apiContactController = require('../controllers/api/ApiContactController')
const apiAuthController = require('../controllers/api/ApiAuthController')
const apiRegisterController = require('../controllers/api/ApiRegisterController')
const apiActiveAccount = require('../controllers/api/ApiActiveAccount')
const apiOrderController = require('../controllers/api/ApiOrderController')
const apiCustomerController = require('../controllers/api/ApiCustomerController')
const apiAddressController = require('../controllers/api/ApiAddressController')
const apiChatBot = require('../controllers/api/Chatbot');
const apiChatbotController = require('../controllers/api/ApiChatbotController');
const apiAskChatbot = require('../controllers/api/Chatbot/askChatbot.controller')
const apiAskImageBot = require('../controllers/api/VirtualTryOn/askImageBot.controller');
// const AgentsController = require('../controllers/multiagents/agentsController');


const multer = require("multer");
const { verifyAccessToken } = require('../utils/verifyAccessToken');
const { startSession } = require('../controllers/api/Chatbot/sessionController');
const { streamLogs, streamAnonLogs } = require('../controllers/api/Chatbot/extra/sseLogs');
const upload = multer({ dest: "uploads/" });


router.get('/categories', apiCategoryController.index);

router.get('/products', apiProductController.index);

router.get('/products/:slug', apiProductController.detail);

router.get('/products/:id/comments', apiProductController.getComment);

router.post('/products/:id/comments', apiProductController.storeComment);

router.post('/sendEmail', apiContactController.sendEmail);

router.post('/login', apiAuthController.login);

router.get('/check-login', apiAuthController.checkLogin);

router.post('/registers', apiRegisterController.register);

router.get('/notExistingEmail/:email', apiRegisterController.notexisting);

router.get('/active_account', apiActiveAccount.active);

router.get('/orders', apiOrderController.orders);

router.post('/checkout', apiOrderController.checkout);

router.patch('/customers/:id/shipping', apiCustomerController.updateShippingDefault);

router.get('/provinces', apiAddressController.getProvinces);

router.get('/districts/province/:provinceId', apiAddressController.getDistricts);

router.get('/wards/district/:districtId', apiAddressController.getWards);

router.get('/shippingFees/:provinceId', apiAddressController.getShippingFees);

router.patch('/customers/:id/account', apiCustomerController.updateInfo);

router.get('/orders/:id', apiOrderController.orderDetail);

router.post('/forgot_password', apiCustomerController.forgotpassword);

router.patch('/reset_password', apiCustomerController.updatePassword);

router.patch('/orders/:orderId/cancel', apiOrderController.cancelOrder);

// router.post('/chatbot', apiChatBot.askChatbot);

router.post('/chatbot', apiAskChatbot.askChatbot);

router.get('/chatbot/history', apiChatbotController.chatHistory);

router.post('/chatbot/merge-session-to-email', apiChatbotController.mergeSessionToEmail);

router.post('/chatbot/websearch', apiChatbotController.searchWeb);

router.get('/shirts', apiProductController.getShirt);

router.post('/tryon', upload.single("image"), apiAskImageBot.askImageBot);

router.get("/start-session", startSession);

router.get("/chatbot/stream-logs", streamLogs);

router.get("/chatbot/stream-anon-logs", streamAnonLogs);

// router.post('/chat', AgentsController.chat);

module.exports = router;