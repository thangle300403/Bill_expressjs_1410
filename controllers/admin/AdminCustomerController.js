const session = require('express-session');
const customerModel = require('../../models/Customer');
const orderModel = require('../../models/Order');

class AdminCustomerController {
    //trả về view -> (req, res)
    static index = async (req, res) => {
        try {
            const page = req.query.page || 1;
            const tier = req.query.tier || null;
            const item_per_page = process.env.PRODUCT_ITEM_PER_PAGE;
            let conds = {};
            let sorts = {};

            const search = req.query.search;
            if (search) {
                conds = {
                    'name': { type: 'LIKE', val: `'%${search}%'` },
                    'email': { type: 'LIKE', val: `'%${search}%'` },
                    'mobile': { type: 'LIKE', val: `'%${search}%'` },
                    'shipping_name': { type: 'LIKE', val: `'%${search}%'` },
                    'shipping_mobile': { type: 'LIKE', val: `'%${search}%'` }
                };
            }

            let customers = await customerModel.getBy(conds, sorts, page, item_per_page);
            const allCustomers = await customerModel.getBy(conds, sorts);
            const totalPage = Math.ceil(allCustomers.length / item_per_page);

            for (let i = 0; i < customers.length; i++) {
                let totalSpent = 0;
                customers[i].orders = await orderModel.getByCustomerId(customers[i].id);

                const orders = customers[i].orders;

                customers[i].codTotal = 0;
                customers[i].bankTotal = 0;

                for (let order of orders) {
                    order.orderItems = await order.getOrderItems();
                    order.status = await order.getStatus();
                    order.total_price = await order.getSubTotalPrice();

                    for (let item of order.orderItems) {
                        item.product = await item.getProduct();
                    }

                    totalSpent += order.total_price + order.shipping_fee;
                    const isDelivered = order.status.name.toLowerCase() === 'delivered';
                    if (isDelivered) {
                        if (order.payment_method === '0') {
                            customers[i].codTotal += order.total_price + order.shipping_fee;
                        } else {
                            customers[i].bankTotal += order.total_price + order.shipping_fee;
                        }
                    }
                }

                orders.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
                customers[i].totalOrders = orders.length;
                customers[i].totalSpent = totalSpent;
                customers[i].lastOrderDate = orders[0]?.created_date || null;
            }

            if (tier) {
                customers = customers.filter((c) => {
                    if (c.totalOrders >= 10 || c.totalSpent >= 5000000) return tier === 'Vàng';
                    if (c.totalOrders >= 3) return tier === 'Bạc';
                    return tier === 'Đồng';
                });
            }

            res.render('admin/customer/index', {
                customers,
                totalPage,
                page,
                layout: 'admin/layout',
                search,
                tier
            });
        } catch (error) {
            res.status(500).send(error.message);
        }
    };

    static create = (req, res) => {
        try {
            res.end('create')
        } catch (error) {
            res.status(500).send(error.message);
        }
    }

    static store = async (req, res) => {
        try {
            res.end('store')
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static edit = async (req, res) => {
        try {
            const customer = await customerModel.find(req.params.id);
            res.render('admin/customer/edit', {
                layout: 'admin/layout',
                customer: customer,
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static update = async (req, res) => {
        try {
            const id = req.body.id;
            await customerModel.update(id, {
                name: req.body.name,
                mobile: req.body.mobile,
                email: req.body.email,
                shipping_name: req.body.shipping_name,
                shipping_mobile: req.body.shipping_mobile,
                housenumber_street: req.body.housenumber_street,
                is_active: req.body.is_active
            });
            // Update session message for success
            req.session.message_success = `Sửa thông tin khách hàng '${req.body.name}' thành công!`;
            req.session.save(() => {
                res.redirect('/admin/customer');
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static destroy = async (req, res) => {
        try {
            const id = req.params.id;
            const customer = await customerModel.find(id);
            const orders = await orderModel.getByCustomerId(id);
            if (orders.length) {
                req.session.message_error = `Không thể xóa khách hàng '${customer.name}' vì có ${orders.length} đơn hàng được đặt!`;
                await req.session.save(() => {
                    return res.redirect('/admin/customer');
                });
            } else {
                await customerModel.destroy(id);
                req.session.message_success = `Xóa khách hàng '${customer.name}' thành công!`;
                await req.session.save(() => {
                    res.redirect('/admin/customer');
                });
            }
        } catch (error) {
            throw new Error(error.message);
        }
    };

}
module.exports = AdminCustomerController;