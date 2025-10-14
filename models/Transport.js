const pool = require('./db');
const provinceModel = require('./Province');
const Base = require('./Base');
class Transport extends Base {
    TABLE_NAME = 'transport';
    SELECT_ALL_QUERY = `SELECT * FROM ${this.TABLE_NAME}`;

    convertRowToObject = (row) => {
        const object = new Transport(row);
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

    getByProvinceId = async (provinceId) => {
        const query = `SELECT * FROM \`${this.TABLE_NAME}\` WHERE province_id = ?`;
        const [rows] = await pool.execute(query, [provinceId]);

        if (!rows.length) {
            return null;
        }

        const transport = new Transport(rows[0]);
        transport.province_id = provinceId; // Set province_id explicitly
        return transport;
    };

    getByProvinceId_checkout = async (province_id) => {
        const transports = await this.fetch(`province_id=${province_id}`);
        if (transports.length > 0) {
            return transports[0];
        }
        return null;
    }

    getProvince = async () => {
        if (!this.province_id) {
            throw new Error('province_id is not set in Transport object');
        }
        const province = await provinceModel.find(this.province_id);
        return province;
    };


    findProvinceById = async (provinceId) => {
        const query = `SELECT * FROM province WHERE id = ?`;
        const [rows] = await pool.execute(query, [provinceId]);
        return rows.length ? rows[0] : null; // Return the first province object or null if not found
    }

    searchByProvinceName = async (provinceName) => {
        try {
            const query = `
                SELECT t.*, p.name as province_name
                FROM transport t JOIN province p ON t.province_id = p.id
                WHERE p.name LIKE ?
            `;
            const [rows] = await pool.execute(query, [`%${provinceName}%`]);
            return rows;
        } catch (error) {
            console.error('Error searching by province name:', error);
            throw error;
        }
    }
}
module.exports = new Transport();
