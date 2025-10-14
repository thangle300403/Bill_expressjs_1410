const Base = require('./Base');
const pool = require('./db');
const { decrypt } = require('../controllers/api/Chatbot/extra/encrypt');

class ChatMcpAdmin extends Base {
    constructor() {
        super();
        this.TABLE_NAME = 'chatbot_admin_history';
        this.SELECT_ALL_QUERY = `SELECT * FROM ${this.TABLE_NAME}`;
    }

    saveChatMessage = async ({ role, content, email }) => {
        await pool.query(
            `INSERT INTO ${this.TABLE_NAME} (role, content, email) VALUES (?, ?, ?)`,
            [role, content, email]
        );
    }

    findByEmail = async (email) => {
        try {
            const [rows] = await pool.execute(
                `${this.SELECT_ALL_QUERY} WHERE email = ? ORDER BY timestamp ASC`,
                [email]
            );

            return rows.map(row => ({
                id: row.id,
                email: row.email,
                timestamp: row.timestamp,
                role: row.role,
                content: row.content ? decrypt(row.content) : null
            }));
        } catch (error) {
            console.error("❌ Error in ChatbotAdmin.findByEmail:", error);
            throw new Error("Failed to fetch chat logs for this admin.");
        }
    };
}

module.exports = new ChatMcpAdmin();
