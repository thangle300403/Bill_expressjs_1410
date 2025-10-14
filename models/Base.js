const pool = require('./db');
class Base {
    constructor(data) {
        const fields = data ? Object.keys(data) : []
        this.fields = fields;
        for (const field of fields) {
            this[field] = data[field];
        }
    }

    buildLimit = (page = null, item_per_page = null) => {
        let limit = '';
        if (page && item_per_page) {
            const row_index = (page - 1) * item_per_page;
            limit = `LIMIT ${row_index}, ${item_per_page}`;
            // Trang 1: LIMIT 0, 4
            // Trang 2: LIMIT 4, 4
        }
        return limit;
    }

    // hàm lấy tất cả các dòng dữ liệu trong bảng
    // Trả về danh sách chứa các đối tượng student
    // là gọi từ class, vd: Student.all, không cần phải new Student(...).all()
    all = async (page = null, item_per_page = null) => {
        try {
            // Xây dựng phân trang
            const limit = this.buildLimit(page, item_per_page);
            const [rows] = await pool.execute(`${this.SELECT_ALL_QUERY} ${limit}`);
            return this.convertArrayToObjects(rows);
        }
        catch (error) {
            throw new Error(error);
        }

    }


    fetch = async (condition = null, sort = null, limit = null) => {
        let sql = this.SELECT_ALL_QUERY;
        if (condition) {
            sql += ` WHERE ${condition}`;
            //SELECT * FROM view_product WHERE name LIKE '%abc%'  AND create_date='2020-08-07'
        }
        if (sort) {
            sql += ` ${sort}`;
            //SELECT * FROM view_product WHERE name LIKE '%abc%'  AND create_date='2020-08-07' ORDER BY name asc, created_date desc
        }
        if (limit) {
            sql += ` ${limit}`;
            //SELECT * FROM view_product WHERE name LIKE '%abc%'  AND create_date='2020-08-07' ORDER BY name asc, created_date desc LIMIT 20, 10
        }
        const [rows] = await pool.execute(sql);
        return this.convertArrayToObjects(rows);
    }

    getByPattern = async (search, page = null, item_per_page = null) => {

        try {
            // Xây dựng phân trang
            const limit = this.buildLimit(page, item_per_page);
            const [rows] = await pool.execute(`${this.SELECT_ALL_QUERY} WHERE name LIKE ? ${limit}`, [`%${search}%`]);
            // SELECT * FROM student WHERE name LIKE '%Ty%'
            return this.convertArrayToObjects(rows);
        }
        catch (error) {
            throw new Error(error);
        }
    }

    // Tìm 1 dòng student 
    find = async (id) => {
        try {
            const [rows] = await pool.execute(`${this.SELECT_ALL_QUERY} WHERE ${this.TABLE_NAME}.id=?`, [id]);
            // check nếu không có dòng nào thỏa mãn trong bảng student
            if (rows.length === 0) {
                return null;
            }
            const row = rows[0];
            // gọi hàm tạo đối tượng
            const object = this.convertRowToObject(row);
            return object;
        }
        catch (error) {
            throw new Error(error);
        }
    }

    convertArrayToObjects = (rows) => {
        const students = rows.map(row => this.convertRowToObject(row));
        return students;
    }

    destroy = async (id) => {
        try {
            await pool.execute(`DELETE FROM \`${this.TABLE_NAME}\` WHERE id=?`, [id]); // Delete the entry by ID
            return true; // Return true if deletion is successful
        } catch (error) {
            throw new Error(error); // Handle errors
        }
    }


    save = async (data) => {
        const questionMarks = [];
        const values = [];
        const colNames = [];
        for (const field in data) {
            questionMarks.push('?');
            values.push(data[field]);
            colNames.push(field);
        }

        try {
            const sql = `INSERT INTO \`${this.TABLE_NAME}\` (${colNames.join(',')}) VALUES (${questionMarks.join(',')})`;
            const [result] = await pool.execute(sql, values);

            return result.insertId;
        } catch (error) {
            throw new Error(error);
        }
    }

    update = async (id, data) => {
        try {
            const cols = [];
            const values = [];
            for (const key in data) {
                // Ensure only valid fields are added
                if (data[key] !== undefined) {
                    cols.push(`${key}=?`);
                    values.push(data[key]);
                }
            }

            // Ensure at least one field to update
            if (cols.length === 0) {
                throw new Error('No fields to update. Ensure the data object contains valid fields.');
            }

            values.push(id); // Add the ID to the end of the values array

            const query = `UPDATE \`${this.TABLE_NAME}\` SET ${cols.join(', ')} WHERE id=?`;

            await pool.execute(query, values);
            return true;
        } catch (error) {
            throw new Error(error.message);
        }
    };
}

module.exports = Base;