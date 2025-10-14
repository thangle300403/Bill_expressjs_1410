const pool = require('./db');
const Base = require('./Base');
class Comment extends Base {

    TABLE_NAME = 'comment';
    SELECT_ALL_QUERY = `SELECT * FROM ${this.TABLE_NAME}`;


    convertRowToObject = (row) => {
        const object = new Comment(row);
        return object;
    }

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

    destroyByProductId = async (productId) => {
        try {
            // Execute the query to delete all comments related to the product ID
            const [result] = await pool.execute('DELETE FROM comment WHERE product_id = ?', [productId]);
            return result;  // Return result or handle appropriately
        } catch (error) {
            throw new Error(error);
        }
    }
}
module.exports = new Comment();
