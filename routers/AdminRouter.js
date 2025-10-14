const express = require('express');
const router = express.Router();
const AdminAuthController = require('../controllers/admin/AdminAuthController');
const AdminBrandController = require('../controllers/admin/AdminBrandController');
const AdminCategoryController = require('../controllers/admin/AdminCategoryController');
const AdminCommentController = require('../controllers/admin/AdminCommentController');
const AdminCustomerController = require('../controllers/admin/AdminCustomerController');
const AdminOrderController = require('../controllers/admin/AdminOrderController');
const AdminProductController = require('../controllers/admin/AdminProductController');
const AdminRoleController = require('../controllers/admin/AdminRoleController');
const AdminStaffController = require('../controllers/admin/AdminStaffController');
const AdminStatusController = require('../controllers/admin/AdminStatusController');
const AdminActionController = require('../controllers/admin/AdminActionController');
const AdminTransportController = require('../controllers/admin/AdminTransportController');
const AdminChatbotController = require('../controllers/admin/AdminChatbotController');
const AdminChatMCPController = require('../controllers/admin/AdminChatMCPController');
const { showChatHistory } = require("../controllers/admin/AdminChatbotController");
const AdminSchemaController = require('../controllers/admin/AdminSchemaController');
const upload = require('../utils/uploadSchema');
const multer = require('multer');
const { pool } = require('../models/db');
const uploadChromna = multer({ dest: "uploadsChroma/" });

function checkLogin(req, res, next) {
    if (req.path == '/login.html' || req.path == '/processLogin') {
        return next();
    }
    // Kiểm tra nếu session đã có thông tin đăng nhập hay chưa
    if (req.session.staff_email && req.session.staff_role_id) {
        return next(); // Người dùng đã đăng nhập, cho phép tiếp tục
    } else {
        return res.redirect('/admin/login.html'); // Chuyển hướng về trang đăng nhập nếu chưa đăng nhập
    }
}

function checkPermission(requiredAction) {
    return async (req, res, next) => {
        try {
            const actionModal = require('../models/Action');
            const roleActionModel = require('../models/RoleAction');

            const action = await actionModal.findByName(requiredAction);

            if (!action) {
                return res.status(404).json({ message: 'Not Found: Action not found' });
            }

            const actionId = action.id;
            const staff_role_id = req.session.staff_role_id;
            const roleAction = await roleActionModel.findByRoleAction(actionId, staff_role_id);
            if (!roleAction) {
                req.session.message_error = 'Bạn không có quyền thực hiện thao tác này!';
                req.session.save(() => {
                    res.redirect('back');
                });
                return;
            }
            next();
        } catch (error) {
            console.error(error);
            res.status(500).send('Internal Server Error');
        }
    };
}

router.use(checkLogin);

// Action routes
router.get('/action', checkPermission('view_permission'), AdminActionController.index);
router.get('/action/edit/:id', checkPermission('edit_permission'), AdminActionController.edit);

// Authentication routes
router.get('/login.html', AdminAuthController.login);
router.get('/logout', AdminAuthController.logout);

// Brand routes
router.get('/brand', checkPermission('view_brand'), AdminBrandController.index);
router.get('/brand/create', checkPermission('add_brand'), AdminBrandController.create);
router.get('/brand/edit/:id', checkPermission('edit_brand'), AdminBrandController.edit);
router.get('/brand/destroy/:id', checkPermission('delete_brand'), AdminBrandController.destroy);

// Category routes
router.get('/category', checkPermission('view_category'), AdminCategoryController.index);
router.get('/category/create', checkPermission('add_category'), AdminCategoryController.create);
router.get('/category/edit/:id', checkPermission('edit_category'), AdminCategoryController.edit);
router.get('/category/destroy/:id', checkPermission('delete_category'), AdminCategoryController.destroy);

// Comment routes
router.get('/comment', checkPermission('view_comment'), AdminCommentController.index);
router.get('/comment/destroy/:id', checkPermission('delete_comment'), AdminCommentController.destroy);

// Customer routes
router.get('/customer', checkPermission('view_customer'), AdminCustomerController.index);
router.get('/customer/edit/:id', checkPermission('edit_customer'), AdminCustomerController.edit);
router.get('/customer/destroy/:id', checkPermission('delete_customer'), AdminCustomerController.destroy);

// Order routes
router.get('/order', checkPermission('view_order'), AdminOrderController.index);
router.get('/order/destroy/:id', checkPermission('delete_order'), AdminOrderController.destroy);

// Product routes
router.get('/', checkPermission('view_product'), AdminProductController.index);
router.get('/store-product.html', checkPermission('store_product'), AdminProductController.store);
router.get('/update-product-:id.html', checkPermission('update_product'), AdminProductController.update);
router.get('/delete-product-:id.html', checkPermission('delete_product'), AdminProductController.destroy);
router.get('/create', checkPermission('add_product'), AdminProductController.create);
router.get('/product/edit/:id', checkPermission('edit_product'), AdminProductController.edit);
router.get('/product/destroy/:id', checkPermission('delete_product'), AdminProductController.destroy);


// Role routes
router.get('/role', checkPermission('view_role'), AdminRoleController.index);
router.get('/role/create', checkPermission('add_role'), AdminRoleController.create);
router.get('/role/edit/:id', checkPermission('edit_role'), AdminRoleController.edit);
router.get('/role/destroy/:id', checkPermission('delete_role'), AdminRoleController.destroy);

// Staff routes
router.get('/staff', checkPermission('view_staff'), AdminStaffController.index);
router.get('/staff/create', checkPermission('add_staff'), AdminStaffController.create);
router.get('/staff/edit/:id', checkPermission('edit_staff'), AdminStaffController.edit);
router.get('/staff/destroy/:id', checkPermission('delete_staff'), AdminStaffController.destroy);

// Status routes
router.get('/status', checkPermission('view_status'), AdminStatusController.index);
router.get('/status/create', checkPermission('add_status'), AdminStatusController.create);
router.get('/status/edit/:id', checkPermission('edit_status'), AdminStatusController.edit);

// Transport routes
router.get('/transport', checkPermission('view_transport'), AdminTransportController.index);
router.get('/transport/edit/:id', checkPermission('edit_transport'), AdminTransportController.edit);

//Revenue routes
router.get('/revenue', checkPermission('view_revenue'), AdminOrderController.revenue);
router.get('/revenue/export/excel', checkPermission('view_revenue'), AdminOrderController.exportExcel);
router.get('/revenue/chart-data', checkPermission('view_revenue'), AdminOrderController.chartData);

router.get("/schema", AdminSchemaController.index);
router.get("/schema/view", AdminSchemaController.view);
router.get("/schema/destroy", AdminSchemaController.destroy);
router.get("/schema/destroy-seed", AdminSchemaController.destroySeedFile);
router.get("/schema/delete-collection", AdminSchemaController.deleteCollection);
router.get("/schema/seed-collection", AdminSchemaController.seedProductDesCollection);
router.get("/schema/view-collection", AdminSchemaController.viewCollection);

router.get("/chatbot-session-check", AdminChatMCPController.checkLogin);
router.get("/chatbot-history", AdminChatMCPController.getHistory);

router.get('/chatbot/logs', checkPermission('view_comment'), AdminChatbotController.getChatLogs);

router.post('/action/update', checkPermission('edit_permission'), AdminActionController.update);
router.post('/processLogin', AdminAuthController.processLogin);
router.post('/brand/store', checkPermission('add_brand'), AdminBrandController.store);
router.post('/brand/update', checkPermission('edit_brand'), AdminBrandController.update);
router.post('/category/store', checkPermission('add_category'), AdminCategoryController.store);
router.post('/category/update', checkPermission('edit_category'), AdminCategoryController.update);
router.post('/customer/update', checkPermission('edit_customer'), AdminCustomerController.update);
router.post('/order/update', checkPermission('edit_order'), AdminOrderController.changeOrderStatus);
router.post('/product/update', checkPermission('edit_product'), AdminProductController.update);
router.post('/role/store', checkPermission('add_role'), AdminRoleController.store);
router.post('/role/update', checkPermission('edit_role'), AdminRoleController.update);
router.post('/role/update-permissions', checkPermission('edit_permission'), AdminRoleController.updateRole);
router.post('/staff/store', checkPermission('add_staff'), AdminStaffController.store);
router.post('/staff/update', checkPermission('edit_staff'), AdminStaffController.update);
router.post('/status/store', checkPermission('add_status'), AdminStatusController.store);
router.post('/status/update', checkPermission('edit_status'), AdminStatusController.update);
router.post('/store', checkPermission('add_product'), AdminProductController.store);
router.post('/transport/update', checkPermission('edit_transport'), AdminTransportController.update);
router.post('/chatbot', AdminChatbotController.respond);
router.post("/schema/upload", upload.single("schemaFile"), AdminSchemaController.upload);
router.post("/schema/create-collection", AdminSchemaController.createCollection);
router.post("/schema/seed-custom", uploadChromna.single("seedFile"), AdminSchemaController.seedCustomCollection);

router.post('/chatbotmcp', AdminChatMCPController.chat);
router.post("/chatbot-login", AdminChatMCPController.chatbotLogin);
router.post("/chatbot/logout", AdminChatMCPController.logout);


router.post("/execute-sql", async (req, res) => {
    const { sql } = req.body;
    try {
        const [result] = await pool.execute(sql);
        res.json({ message: "SQL executed successfully.", result });
    } catch (err) {
        console.error("SQL exec error:", err);
        res.status(500).json({ message: "Error executing SQL", error: err.message });
    }
});

router.post("/chatbot-log", async (req, res) => {
    const { role, content } = req.body;
    const email = req.session?.staff_email

    try {
        await ChatMcpAdmin.saveChatMessage({
            role,
            content: encrypt(content),
            email
        });
        res.json({ message: "Saved to chat history." });
    } catch (err) {
        console.error("❌ Chat log save error:", err);
        res.status(500).json({ message: "Error saving chat message." });
    }
});

module.exports = router;
