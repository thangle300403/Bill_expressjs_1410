import pool from "../../models/db.js";
import { encrypt } from "../../controllers/api/Chatbot/extra/encrypt.js";

export async function saveChatLog({ role, content, email = null }) {
    const sql = `INSERT INTO chat_logs_admin (role, content, email) VALUES (?, ?, ?)`;
    await pool.query(sql,
        [role, encrypt(content), email]
    );
}
