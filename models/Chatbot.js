const Base = require('./Base');
const pool = require('./db');
const { decrypt } = require('../controllers/api/Chatbot/extra/encrypt');

class Chatbot extends Base {
    TABLE_NAME = 'chat_history';
    SELECT_ALL_QUERY = `SELECT * FROM ${this.TABLE_NAME}`;

    convertRowToObject = (row) => {
        const object = new Chatbot(row);
        return object;
    }

    findByEmail = async (email) => {
        const [rows] = await pool.execute(
            "SELECT role, content, created_at FROM chatbot_history_role WHERE user_email = ? ORDER BY created_at ASC LIMIT 50",
            [email]
        );

        return rows.map((row) => ({
            role: row.role,
            content: decrypt(row.content),
            created_at: row.created_at,
        }));
    };

    findByEmailOrSession = async (email, session_id) => {
        const [rows] = await pool.execute(
            `SELECT * FROM (
        SELECT * 
        FROM chatbot_history_role
        WHERE 
          user_email = ? 
          OR ((user_email IS NULL OR user_email = '') AND session_id = ?)
        ORDER BY created_at DESC, id DESC
        LIMIT 30
    ) sub
    ORDER BY created_at ASC, id ASC`,
            [email, session_id]
        );

        return rows.map((row) => ({
            role: row.role,
            content: decrypt(row.content),
            created_at: row.created_at,
        }));
    };


    findByEmailOrSessionFE = async (email, session_id) => {
        let rows;

        const hasEmail = email && email.trim() !== "";

        if (hasEmail) {
            [rows] = await pool.execute(
                `SELECT * FROM (
                 SELECT * 
                 FROM chatbot_history_role
                 WHERE user_email = ?
                 ORDER BY created_at DESC, id DESC
                 LIMIT 30
             ) sub
             ORDER BY created_at ASC, id ASC`,
                [email]
            );
        } else {
            [rows] = await pool.execute(
                `SELECT *
   FROM (
       SELECT * 
       FROM chatbot_history_role
       WHERE (user_email IS NULL OR user_email = '') AND session_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 30
   ) sub
   ORDER BY created_at ASC, id ASC`,
                [session_id]
            );
        }

        return rows.map((row) => ({
            role: row.role,
            content: decrypt(row.content),
            created_at: row.created_at,
        }));
    };

    mergeSessionToEmail = async (email, session_id) => {
        return await pool.execute(
            `UPDATE chatbot_history_role
 SET user_email = ?
 WHERE session_id = ? AND (user_email IS NULL OR user_email = '')`,
            [email, session_id]
        );
    };


    findByMessageAndEmail = async (message, email) => {
        try {
            const [rows] = await pool.execute(
                `${this.SELECT_ALL_QUERY} WHERE message = ? AND user_email = ? ORDER BY created_at DESC LIMIT 50`,
                [message, email]
            );

            if (rows.length === 0) {
                return [];
            }

            const objects = rows.map((row) => {
                const obj = this.convertRowToObject(row);
                return {
                    ...obj,
                    question: decrypt(obj.question),
                    ai_answer: decrypt(obj.ai_answer),
                    message: obj.message ? decrypt(obj.message) : "",
                };
            });

            return objects;
        } catch (error) {
            throw new Error(error);
        }
    };

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
}
module.exports = new Chatbot();
