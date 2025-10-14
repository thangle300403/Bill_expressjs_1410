const pool = require('./db');
const Base = require('./Base');
class ImageItem extends Base {

    TABLE_NAME = 'image_item';
    SELECT_ALL_QUERY = `SELECT * FROM ${this.TABLE_NAME}`;

    convertRowToObject = (row) => {
        const object = new ImageItem(row);
        return object;
    }

    // later
    getProducts = () => {

    }

    getByProductId = async (product_id) => {
        try {
            const [rows] = await pool.execute(`${this.SELECT_ALL_QUERY} WHERE ${this.TABLE_NAME}.product_id=?`, [product_id]);
            // check nếu không có dòng nào thỏa mãn trong bảng student
            return this.convertArrayToObjects(rows);
        }
        catch (error) {
            throw new Error(error);
        }
    }

}
module.exports = new ImageItem();
