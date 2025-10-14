const pool = require('./db');
const Base = require('./Base');
class ProductEmbedding extends Base {

    TABLE_NAME = 'product_embedding';
    SELECT_ALL_QUERY = `SELECT * FROM ${this.TABLE_NAME}`;

    convertRowToObject = (row) => {
        const object = new ProductEmbedding(row);
        return object;
    }

    getAll = async () => {
        try {
            const [rows] = await pool.execute(`${this.SELECT_ALL_QUERY}`);
            return rows;
        } catch (error) {
            throw new Error(error);
        }
    };
}
module.exports = new ProductEmbedding();
