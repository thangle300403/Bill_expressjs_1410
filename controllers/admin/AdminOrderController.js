const session = require('express-session');
const orderModel = require('../../models/Order');
const orderItemModel = require('../../models/OrderItem');
const statusModel = require('../../models/Status');
const ExcelJS = require('exceljs');
const productModel = require('../../models/Product');
const customerModel = require('../../models/Customer');

class AdminOrderController {
    static index = async (req, res) => {
        try {
            const page = req.query.page || 1;
            const item_per_page = process.env.PRODUCT_ITEM_PER_PAGE;
            let conds = {};
            let sorts = {};

            const search = req.query.search;
            const statusFilter = req.query.statusFilter || "";

            if (search) {
                // Searching by shipping_fullname
                conds.id = {
                    type: 'LIKE',
                    val: `'%${search}%'`
                };
            }

            if (statusFilter) {
                conds.order_status_id = { type: "=", val: statusFilter };
            }


            const orders = await orderModel.getBy(conds, sorts, page, item_per_page);

            const statuses = await statusModel.all();

            const allOrders = await orderModel.getBy(conds, sorts);

            const totalPage = Math.ceil(allOrders.length / item_per_page); //để phân trag

            for (let i = 0; i <= orders.length - 1; i++) {
                orders[i].orderItems = await orders[i].getOrderItems();
                orders[i].status = await orders[i].getStatus();
                for (let j = 0; j <= orders[i].orderItems.length - 1; j++) {
                    orders[i].orderItems[j].product = await orders[i].orderItems[j].getProduct();
                }
                orders[i].total_price = await orders[i].getSubTotalPrice();
            }

            res.render('admin/order/index', {
                statuses: statuses,
                orders: orders,
                totalPage: totalPage,
                page: page,
                layout: 'admin/layout',
                search: search,
                statusFilter,
            });
        } catch (error) {
            res.status(500).send(error.message);
        }
    };

    static changeOrderStatus = async (req, res) => {
        try {
            const orderId = req.body.id;
            const orderStatusId = parseInt(req.body.order_status);
            const cancelReasonKey = req.body.cancel_reason;

            const order = await orderModel.find(orderId);
            const currentStatus = await order.getStatus();
            const newStatus = await statusModel.find(orderStatusId);

            const customer = await customerModel.find(order.customer_id);
            const customerEmail = customer.email;
            const customerName = customer.name;

            const cancelReasons = {
                stock_error: 'Một hoặc nhiều sản phẩm trong đơn hàng đã hết hàng.',
                payment_timeout: 'Bạn chưa hoàn tất thanh toán đúng hạn.',
                customer_request: 'Đơn hàng được huỷ theo yêu cầu của bạn.',
                fraud_detected: 'Đơn hàng có dấu hiệu bất thường và đã bị từ chối.',
                shipping_issue: 'Thông tin giao hàng không hợp lệ hoặc không thể vận chuyển tới địa chỉ của bạn.',
                product_issue: 'Một hoặc nhiều sản phẩm trong đơn hàng có vấn đề trong lúc thử nghiệm.',
                other: 'Đơn hàng đã bị huỷ do một lý do khác.'
            };

            let updated = false;
            if (currentStatus.name !== 'delivered' && currentStatus.name !== 'canceled') {
                updated = await orderModel.update(orderId, { order_status_id: orderStatusId });
            }

            if (updated) {
                req.session.message_success = `Cập nhật trạng thái đơn hàng số ${orderId} thành công`;

                const orderItems = await order.getOrderItems();

                // Deduct inventory if packaging
                if (newStatus.id === 3) {
                    for (const item of orderItems) {
                        await productModel.decreaseQty(item.product_id, item.qty);
                    }
                }

                // Restore inventory if canceled after packaging
                if (newStatus.id === 6 && currentStatus.id === 3) {
                    for (const item of orderItems) {
                        await productModel.increaseQty(item.product_id, item.qty);
                    }
                }

                // Send email on cancellation
                if (newStatus.id === 6) {
                    const reasonText = cancelReasons[cancelReasonKey] || cancelReasons.other;
                    const subject = `Godashop - Hủy đơn hàng #${orderId}`;
                    const web = process.env.FRONTEND_URL;
                    const to = customerEmail;

                    const content = `
                      <p>Xin chào ${customerName},</p>
                      <p>Chúng tôi xin thông báo rằng đơn hàng <strong>#${order.id}</strong> của bạn đã bị huỷ.</p>
                      <p><strong>Lý do:</strong> ${reasonText}</p>
                      <p>Nếu bạn có bất kỳ câu hỏi nào, xin vui lòng liên hệ với chúng tôi.</p>
                      <p>Xin cảm ơn,<br>Đội ngũ Goda Shop</p>
                      <br/>
                      <small>Email được gửi từ website ${web}</small>
                    `;

                    await req.app.locals.helpers.sendEmail(to, subject, content);
                    req.session.message_success = `Đã huỷ đơn hàng số ${orderId} và gửi email thông báo tới khách hàng.`;
                }

            } else {
                req.session.message_error = `Đơn hàng số ${orderId} đang ở trạng thái: ${currentStatus.description}, không thay đổi được!`;
            }

            req.session.save(() => {
                res.redirect('/admin/order');
            });

        } catch (error) {
            console.error("Lỗi cập nhật trạng thái đơn hàng:", error);
            res.status(500).send(error.message);
        }
    };

    static sendCancelMail = async (req, res) => {
        try {
            const orderId = req.body.id;
            const order = await orderModel.find(orderId);

            const subject = 'Godashop - Hủy đơn hàng';
            const web = process.env.FRONTEND_URL;
            const to = customerEmail;
            const content = `
                        Xin chào ${customerName}, <br>
                        Xin vui lòng click vào link bên dưới để tạo mới mật khẩu, <br>
                        Được gởi từ web ${web}.
                        `;
            req.app.locals.helpers.sendEmail(to, subject, content);
            req.session.message_success = `Vui lòng kiểm tra ${email} để tạo mới mật khẩu.`;
            req.session.save(() => {
                res.redirect('/');
            });
        } catch (error) {
            res.status(500).send(error.message);
        }
    };


    static destroy = async (req, res) => {
        try {
            const id = req.params.id;
            const order = await orderModel.find(id);
            const status = await order.getStatus();
            if (status.name === 'ordered' || status.name === 'confirmed' || status.name === 'delivered' || status.name === 'canceled') {
                await orderItemModel.destroyByOrderId(id);
                await orderModel.destroy(id);
                req.session.message_success = `Xóa đơn hàng số ${id} thành công!`;
            } else {
                req.session.message_error = `Đơn hàng số ${id} đã qua xác nhận nhưng chưa được giao đến địa chỉ, không thể xóa!`;
            }
            req.session.save(() => {
                res.redirect('/admin/order');
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static revenue = async (req, res) => {
        try {
            const { from, to } = req.query;

            const orders = await orderModel.all();

            let totalRevenue = 0;
            let totalCOD = 0;
            let totalBank = 0;
            let codOrders = [];
            let bankOrders = [];

            for (const order of orders) {
                if (from && new Date(order.created_date) < new Date(from)) continue;
                if (to && new Date(order.created_date) > new Date(to)) continue;

                const status = await order.getStatus();
                const isCOD = order.payment_method === '0';
                const isTransfer = order.payment_method === '1';
                const isDelivered = status.name.toLowerCase().includes('delivered');

                if ((isCOD && isDelivered) || isTransfer) {
                    const orderTotal = await order.getSubTotalPrice() + order.shipping_fee;
                    totalRevenue += orderTotal;

                    if (isCOD) totalCOD += orderTotal;
                    if (isTransfer) totalBank += orderTotal;
                }
            }

            for (const order of orders) {
                const createdDate = new Date(order.created_date);
                if (from && createdDate < new Date(from)) continue;
                if (to && createdDate > new Date(to)) continue;

                const status = await order.getStatus();
                const statusName = status.name.toLowerCase();
                const isCOD = order.payment_method == 0;
                const isTransfer = order.payment_method == 1;

                const orderTotal = await order.getSubTotalPrice() + order.shipping_fee;

                if ((isCOD && statusName === 'delivered') || isTransfer) {
                    totalRevenue += orderTotal;
                    order.status = status;

                    if (isCOD && statusName === 'delivered') {
                        totalCOD += orderTotal;
                        order.status = status;
                        order.orderTotal = orderTotal;
                        codOrders.push(order);
                    }

                    if (isTransfer) {
                        totalBank += orderTotal;
                        order.status = status;
                        order.orderTotal = orderTotal;
                        bankOrders.push(order);
                    }
                }
            }

            for (let i = 0; i <= codOrders.length - 1; i++) {
                codOrders[i].orderItems = await codOrders[i].getOrderItems();
                codOrders[i].status = await codOrders[i].getStatus();
                for (let j = 0; j <= codOrders[i].orderItems.length - 1; j++) {
                    codOrders[i].orderItems[j].product = await codOrders[i].orderItems[j].getProduct();
                }
                codOrders[i].total_price = await codOrders[i].getSubTotalPrice();
            }

            for (let i = 0; i <= bankOrders.length - 1; i++) {
                bankOrders[i].orderItems = await bankOrders[i].getOrderItems();
                bankOrders[i].status = await bankOrders[i].getStatus();
                for (let j = 0; j <= bankOrders[i].orderItems.length - 1; j++) {
                    bankOrders[i].orderItems[j].product = await bankOrders[i].orderItems[j].getProduct();
                }
                bankOrders[i].total_price = await bankOrders[i].getSubTotalPrice();
            }

            res.render('admin/revenue/index', {
                layout: 'admin/layout',
                totalRevenue,
                totalCOD,
                totalBank,
                codOrders,
                bankOrders,
                from,
                to
            });
        } catch (error) {
            res.status(500).send(error.message);
        }
    };

    static exportExcel = async (req, res) => {
        try {
            const orders = await orderModel.all();
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Revenue Report');

            sheet.columns = [
                { header: 'ID Đơn hàng', key: 'id', width: 15 },
                { header: 'Ngày tạo', key: 'created_date', width: 25 },
                { header: 'Khách hàng', key: 'shipping_fullname', width: 25 },
                { header: 'Phương thức', key: 'payment_method', width: 15 },
                { header: 'Tổng tiền', key: 'total', width: 15 },
                { header: 'Trạng thái', key: 'status', width: 25 }
            ];

            for (const order of orders) {
                const status = await order.getStatus();
                const orderTotal = await order.getSubTotalPrice() + order.shipping_fee;
                sheet.addRow({
                    id: order.id,
                    created_date: order.created_date,
                    shipping_fullname: order.shipping_fullname,
                    payment_method: order.payment_method == 0 ? 'COD' : 'Chuyển khoản',
                    total: orderTotal,
                    status: status.description
                });
            }

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=revenue.xlsx');

            await workbook.xlsx.write(res);
            res.end();
        } catch (error) {
            res.status(500).send(error.message);
        }
    };

    static chartData = async (req, res) => {
        try {
            const { from, to } = req.query;
            const orders = await orderModel.all();
            const dataMap = {};

            for (const order of orders) {
                const createdDate = new Date(order.created_date);
                if (from && createdDate < new Date(from)) continue;
                if (to && createdDate > new Date(to)) continue;

                const status = await order.getStatus();
                const statusName = status.name.toLowerCase();
                const isCOD = order.payment_method == 0;
                const isTransfer = order.payment_method == 1;
                const isDelivered = statusName === 'delivered';

                if ((isCOD && isDelivered) || isTransfer) {
                    const key = from && to && new Date(from).getMonth() === new Date(to).getMonth()
                        ? createdDate.toISOString().slice(0, 10) // daily
                        : `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`; // monthly

                    if (!dataMap[key]) {
                        dataMap[key] = { cod: 0, bank: 0 };
                    }

                    const orderTotal = await order.getSubTotalPrice() + order.shipping_fee;
                    if (isCOD && isDelivered) dataMap[key].cod += orderTotal;
                    if (isTransfer) dataMap[key].bank += orderTotal;
                }
            }

            const labels = Object.keys(dataMap).sort();
            const codValues = labels.map(key => dataMap[key].cod);
            const bankValues = labels.map(key => dataMap[key].bank);

            res.json({ labels, codValues, bankValues });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

}
module.exports = AdminOrderController;