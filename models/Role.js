const pool = require('./db');
const Base = require('./Base');
class Role extends Base {
    TABLE_NAME = 'role';
    SELECT_ALL_QUERY = `SELECT * FROM ${this.TABLE_NAME}`;

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
        const object = new Role(row);
        return object;
    }


}
module.exports = new Role();
