const Base = require('./Base');
const pool = require('./db');
const { decrypt } = require('../controllers/api/Chatbot/extra/encrypt');

class ChatbotAdmin extends Base {
    constructor() {
        super();
        this.TABLE_NAME = 'chat_logs_admin';
        this.SELECT_ALL_QUERY = `SELECT * FROM ${this.TABLE_NAME}`;
    }

    findByEmail = async (email) => {
        try {
            const [rows] = await pool.execute(
                `${this.SELECT_ALL_QUERY} WHERE email = ? ORDER BY timestamp ASC`,
                [email]
            );

            if (rows.length === 0) return [];

            const logs = rows.map((row) => {
                return {
                    id: row.id,
                    email: row.email,
                    timestamp: row.timestamp,
                    role: row.role,
                    content: row.content ? decrypt(row.content) : null,
                };
            });

            return logs;
        } catch (error) {
            console.error("❌ Error in ChatbotAdmin.findByEmail:", error);
            throw new Error("Failed to fetch chat logs for this admin.");
        }
    };
}

module.exports = new ChatbotAdmin();
