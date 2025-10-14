const pool = require('./db');
const Base = require('./Base');
const orderItemModel = require('./OrderItem');
const statusModel = require('../models/Status');
const wardModel = require('../models/Ward');

class Order extends Base {
    TABLE_NAME = 'order';
    SELECT_ALL_QUERY = `SELECT * FROM \`${this.TABLE_NAME}\``;

    getBy = async (array_conds = [], array_sorts = [], page = null, qty_per_page = null) => {
        let page_index;
        if (page) {
            page_index = page - 1;
        }
        let temp = [];
        for (let column in array_conds) {
            let cond = array_conds[column];
            let type = cond.type;
            let val = cond.val;
            let str = `${column} ${type} `;
            if (["BETWEEN", "LIKE"].includes(type)) {
                str += val; //name LIKE '%abc%'
            } else {
                str += `'${val}'`;
            }
            temp.push(str);
        }
        let condition = null;
        if (Object.keys(array_conds).length) {
            condition = temp.join(" AND ");
        }
        temp = [];
        for (let key in array_sorts) {
            let sort = array_sorts[key];
            temp.push(`${key} ${sort}`);
        }
        let sort = null;
        if (Object.keys(array_sorts).length) {
            sort = `ORDER BY ${temp.join(" , ")}`;
        }
        let limit = null;
        if (qty_per_page) {
            let start = page_index * qty_per_page;
            limit = `LIMIT ${start}, ${qty_per_page}`;
        }

        return await this.fetch(condition, sort, limit);
    }

    convertRowToObject = (row) => {
        const object = new Order(row);
        return object;
    }

    // Tìm 1 dòng student 
    getByCustomerId = async (customer_id) => {
        try {
            const [rows] = await pool.execute(`${this.SELECT_ALL_QUERY} WHERE ${this.TABLE_NAME}.customer_id=? ORDER BY id DESC`, [customer_id]);

            // check nếu không có dòng nào thỏa mãn trong bảng student
            if (rows.length === 0) {
                return [];
            }
            // gọi hàm tạo đối tượng
            const objects = this.convertArrayToObjects(rows);
            return objects;
        }
        catch (error) {
            throw new Error(error);
        }

    }

    getByStatusId = async (order_status_id) => {
        try {
            const [rows] = await pool.execute(`${this.SELECT_ALL_QUERY} WHERE ${this.TABLE_NAME}.order_status_id=? ORDER BY id DESC`, [order_status_id]);

            // check nếu không có dòng nào thỏa mãn trong bảng student
            if (rows.length === 0) {
                return [];
            }
            // gọi hàm tạo đối tượng
            const objects = this.convertArrayToObjects(rows);
            return objects;
        }
        catch (error) {
            throw new Error(error);
        }
    }

    getOrderItems = async () => {
        const orderItems = await orderItemModel.getByOrderId(this.id);
        return orderItems;
    }

    getStatus = async () => {
        const status = await statusModel.find(this.order_status_id);
        return status;
    }

    updateOrderStatus = async (orderId, newStatus) => {
        try {
            const [result] = await pool.execute(
                `UPDATE \`${this.TABLE_NAME}\` SET order_status_id = ? WHERE id = ?`,
                [newStatus, orderId]
            );
            return result.affectedRows > 0; // Return true if the update was successful
        } catch (error) {
            throw new Error(error);
        }
    }

    getShippingWard = async () => {
        const ward = await wardModel.find(this.shipping_ward_id);
        return ward;
    }

    getSubTotalPrice = async () => {
        const orderItems = await orderItemModel.getByOrderId(this.id);
        let totalPrice = 0;
        for (const orderItem of orderItems) {
            totalPrice += orderItem.unit_price * orderItem.qty;
        }

        return totalPrice;
    }
}
module.exports = new Order();
