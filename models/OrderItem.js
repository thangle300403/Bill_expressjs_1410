const pool = require('./db');
const Base = require('./Base');
const productModel = require('./Product')
class OrderItem extends Base {

    TABLE_NAME = 'order_item';
    SELECT_ALL_QUERY = `SELECT * FROM ${this.TABLE_NAME}`;


    convertRowToObject = (row) => {
        const object = new OrderItem(row);
        return object;
    }


    getByOrderId = async (order_id) => {
        try {
            const [rows] = await pool.execute(`${this.SELECT_ALL_QUERY} WHERE ${this.TABLE_NAME}.order_id=?`, [order_id]);
            // check nếu không có dòng nào thỏa mãn trong bảng student
            return this.convertArrayToObjects(rows);
        }
        catch (error) {
            throw new Error(error);
        }
    }

    getProduct = async () => {
        const product = await productModel.find(this.product_id);
        return product;
    }

    findByProductId = async (product_id) => {
        try {
            const [rows] = await pool.execute(`${this.SELECT_ALL_QUERY} WHERE order_item.product_id=?`, [product_id]);
            return rows;  // Return all rows directly, as an array of products
        }
        catch (error) {
            throw new Error(error);
        }
    }

    destroyByOrderId = async (orderId) => {
        try {
            // Execute the query to delete all comments related to the product ID
            const [result] = await pool.execute('DELETE FROM order_item WHERE order_id = ?', [orderId]);
            return result;  // Return result or handle appropriately
        } catch (error) {
            throw new Error(error);
        }
    }

}
module.exports = new OrderItem();
