import pool from "../../../../models/db.js";
import { encrypt } from "../extra/encrypt.js";

export const saveChatHistory = async ({ email = null, session_id = null, role, content }) => {
    await pool.execute(
        `INSERT INTO chatbot_history_role 
         (user_email, session_id, role, content, created_at) 
         VALUES (?, ?, ?, ?, NOW())`,
        [email, session_id, role, encrypt(content)]
    );
};
