import pool from "../../../../models/db.js";
import { encrypt } from "../extra/encrypt.js";

export const saveChatHistory = async ({ email, role, content }) => {
    await pool.execute(
        "INSERT INTO chatbot_history_role (user_email, role, content, created_at) VALUES (?, ?, ?, NOW())",
        [email, role, encrypt(content)]
    );
};
