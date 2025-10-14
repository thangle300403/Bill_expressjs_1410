const jwt = require('jsonwebtoken');
const customerModel = require('../../models/Customer');
const orderModel = require('../../models/Order');
const transportModel = require('../../models/Transport');
const orderItemModel = require('../../models/OrderItem');
const wardModel = require('../../models/Ward')
const fs = require('fs');
const path = require('path');

class ApiOrderController {
    static orders = async (req, res) => {
        try {
            const baseUrl = process.env.IMAGE_BASE_URL;
            const token = req.headers.authorization?.split(' ')[1];
            if (!token) return res.status(401).json({ message: 'Access token missing' });

            const decoded = jwt.verify(token, process.env.JWT_KEY);
            const email = decoded.email;

            const customer = await customerModel.findEmail(email);
            if (!customer) return res.status(404).json({ message: 'Customer not found' });

            const customer_id = customer.id;

            let orders = await orderModel.getByCustomerId(customer_id);
            orders = orders.map(({ fields, ...rest }) => rest);

            for (let i = 0; i < orders.length; i++) {
                const order = orders[i];

                // Load order items and map to 'order_items'
                const orderItems = await order.getOrderItems();
                for (let j = 0; j < orderItems.length; j++) {
                    const product = await orderItems[j].getProduct();

                    // Fix image URL
                    if (product?.featured_image && !product.featured_image.startsWith('http')) {
                        product.featured_image = baseUrl + product.featured_image;
                    }

                    orderItems[j].product = product;
                }
                order.order_items = orderItems;

                // Add status description
                const status = await order.getStatus();
                order.status_description = status?.description || 'Chưa xác định';
                order.delivered_date = order.delivered_date || null;

                // Add ward/district/province names
                const ward = await order.getWard?.();
                if (ward) {
                    order.ward_name = ward.name;
                    const district = await ward.getDistrict?.();
                    if (district) {
                        order.district_name = district.name;
                        const province = await district.getProvince?.();
                        if (province) {
                            order.province_name = province.name;
                        }
                    }
                }

                // Clean up original field
                delete order.fields;
                delete order.orderItems;
            }

            res.json(orders);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    };

    static getBase64Image = (filename) => {
        const imagePath = path.join(__dirname, '../../public/images', filename); // 🔥 Full path
        console.log('🧩 Reading image:', imagePath);
        try {
            const imageData = fs.readFileSync(imagePath);
            const base64 = imageData.toString('base64');
            const ext = path.extname(imagePath).slice(1);
            return `data:image/${ext};base64,${base64}`;
        } catch (error) {
            console.error('⚠️ Failed to read image:', filename, error.message);
            return '';
        }
    };

    static checkout = async (req, res) => {
        try {
            const cartItems = req.body.cartItems || [];
            const deliveryInfo = req.body.deliveryInfo;
            const loggedUser = req.body.loggedUser;

            const paymentMethodMap = {
                0: 'Thanh toán khi nhận hàng (COD)',
                1: 'Chuyển khoản ngân hàng',
                2: 'Thanh toán qua ví điện tử',
                3: 'Thẻ tín dụng/Ghi nợ',
            };

            if (!cartItems.length) {
                return res.status(400).json({ message: 'Giỏ hàng trống.', cartItems: [] });
            }

            if (!loggedUser?.id) {
                return res.status(401).json({ message: 'Người dùng chưa đăng nhập.' });
            }

            const transport = await transportModel.getByProvinceId(deliveryInfo.province);

            if (!transport) {
                return res.status(400).json({ message: 'Không tìm thấy thông tin phí giao hàng.' });
            }

            const shipping_fee = transport.price;

            const data = {
                created_date: req.app.locals.helpers.getCurrentDateTime(),
                order_status_id: 1,
                staff_id: null,
                customer_id: loggedUser.id,
                shipping_fullname: deliveryInfo.fullname,
                shipping_mobile: deliveryInfo.mobile,
                payment_method: deliveryInfo.payment_method,
                shipping_ward_id: deliveryInfo.ward,
                shipping_housenumber_street: deliveryInfo.address,
                shipping_fee: shipping_fee,
                delivered_date: req.app.locals.helpers.getThreeLaterDateTime(),
            };

            const orderId = await orderModel.save(data);

            for (const item of cartItems) {
                const itemData = {
                    product_id: item.id,
                    order_id: orderId,
                    qty: item.qty,
                    unit_price: item.sale_price,
                    total_price: item.qty * item.sale_price,
                };
                await orderItemModel.save(itemData);
            }

            //for email
            const paymentMethodText = paymentMethodMap[deliveryInfo.payment_method] || 'Không xác định';

            const ward = await wardModel.find(deliveryInfo.ward);
            const district = await ward?.getDistrict();
            const province = await district?.getProvince();

            const fullAddress = `${deliveryInfo.address}, ${ward?.name || ''}, ${district?.name || ''}, ${province?.name || ''}`;

            // Prepare order confirmation email
            const to = loggedUser.email;
            const subject = 'Godashop - Xác nhận đơn hàng';
            const web = process.env.FRONTEND_URL;

            const productListHTML = cartItems.map(item => {
                const imageName = item.featured_image?.split('/').pop(); // get only the filename
                const imgBase64 = imageName
                    ? ApiOrderController.getBase64Image(imageName)
                    : '';

                console.log('base64', imgBase64.substring(0, 100));
                console.log('🖼 featured_image =', item.featured_image);
                console.log('📦 imageName =', imageName);
                console.log('📏 imgBase64 size =', imgBase64.length);
                return `
        <li style="margin-bottom: 15px;">
            <img src="${imgBase64}" alt="${item.name}" width="80" style="display:block; margin-bottom: 5px;" />
            ${item.name} - SL: ${item.qty} - Đơn giá: ${item.sale_price.toLocaleString()}đ - Thành tiền: ${(item.qty * item.sale_price).toLocaleString()}đ
        </li>
    `;
            }).join('');

            const content = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>ĐƠN HÀNG MỚI</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      color: #333;
    }
    .card {
      max-width: 500px;
      margin: auto;
      border: 1px solid #ccc;
      padding: 20px;
    }
    h2 {
      color: #000;
    }
    ul {
      padding-left: 20px;
    }
    .total {
      font-weight: bold;
      margin-top: 10px;
    }
    .info {
      margin-top: 15px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h2>🎉 Cảm ơn bạn đã đặt hàng tại Godashop!</h2>
    <p>Xin chào ${deliveryInfo.fullname},</p>
    <p>Chúng tôi đã nhận được đơn hàng của bạn:</p>
    <ul>
      ${productListHTML}
    </ul>
    <hr/>
    <p class="total">Phí giao hàng: ${shipping_fee.toLocaleString()}đ</p>
    <p class="info">
      <b>Địa chỉ giao hàng:</b><br>
      ${fullAddress}<br>
      <b>Hình thức thanh toán:</b> ${paymentMethodText}<br>
      <b>SĐT:</b> ${deliveryInfo.mobile}
    </p>
    <hr/>
    <p>Đơn hàng sẽ được xử lý trong vòng 3 ngày. Bạn có thể kiểm tra chi tiết đơn hàng của mình trên website: <a href="${web}">${web}</a></p>
    <p>Trân trọng,<br/>Đội ngũ Godashop</p>
  </div>
</body>
</html>
`;
            fs.writeFileSync('test-email.html', content);
            await req.app.locals.helpers.sendEmail(to, subject, content);

            console.log(`📧 Sent order confirmation to ${to}`);

            return res.status(201).json({
                message: 'Đơn hàng đã được tạo thành công.',
                order_id: orderId,
                loggedUser: loggedUser,
                deliveryInfo: deliveryInfo,
                cartItems: cartItems
            });
        } catch (error) {
            console.error('Error processing order:', error);
            return res.status(500).json({
                message: 'Lỗi xử lý đơn hàng.',
                error: error.message
            });
        }
    };

    static orderDetail = async (req, res) => {
        try {
            const baseUrl = process.env.IMAGE_BASE_URL;
            const id = req.params.id;

            const order = await orderModel.find(id);
            if (!order) return res.status(404).json({ message: 'Order not found' });

            const orderItems = await order.getOrderItems();

            // Attach product info
            for (let item of orderItems) {
                const product = await item.getProduct();

                // Add full image URL if needed
                if (product?.featured_image && !product.featured_image.startsWith('http')) {
                    product.featured_image = baseUrl + product.featured_image;
                }

                item.product = product;
            }

            order.order_items = orderItems;

            // Add status
            const status = await order.getStatus();
            order.status_description = status?.description || 'Chưa xác định';

            // Add address info
            const ward = await order.getShippingWard();
            if (ward) {
                order.ward_name = ward.name;

                const district = await ward.getDistrict?.();
                if (district) {
                    order.district_name = district.name;

                    const province = await district.getProvince?.();
                    if (province) {
                        order.province_name = province.name;
                    }
                }
            }

            // Optional: add total price
            order.total_price = await order.getSubTotalPrice();

            // Clean up unnecessary fields if needed
            delete order.fields;
            delete order.orderItems;

            res.json(order);
        } catch (error) {
            console.error('❌ orderDetail error:', error);
            res.status(500).json({ message: 'Lỗi server', error: error.message });
        }
    };

    static cancelOrder = async (req, res) => {
        try {
            const token = req.headers.authorization?.split(' ')[1];
            if (!token) return res.status(401).json({ message: 'Access token missing' });

            const decoded = jwt.verify(token, process.env.JWT_KEY);
            const email = decoded.email;

            const customer = await customerModel.findEmail(email);
            if (!customer) return res.status(404).json({ message: 'Customer not found' });

            const { orderId } = req.params;

            console.log('orderId', orderId);

            const order = await orderModel.find(orderId);
            if (!order || order.customer_id !== customer.id) {
                return res.status(403).json({ message: 'Unauthorized or order not found' });
            }

            const status = await order.getStatus();

            console.log('status', status);

            if (![1, 2].includes(status.id)) {
                return res.status(400).json({ message: 'Không thể huỷ đơn hàng ở trạng thái hiện tại.' });
            }

            const updated = await orderModel.update(orderId, { order_status_id: 6 });

            if (updated) {
                // ✅ If current status was 3 (packaged), restore inventory
                if (status.id == 3) {
                    const orderItems = await order.getOrderItems();
                    for (const item of orderItems) {
                        await productModel.increaseQty(item.product_id, item.qty);
                    }
                }

                return res.json({ message: `✅ Đã huỷ đơn hàng #${orderId}` });
            }

            return res.status(500).json({ message: '❌ Cập nhật thất bại. Vui lòng thử lại.' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    };
}

module.exports = ApiOrderController;
