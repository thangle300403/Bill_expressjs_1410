import pool from "../../../../models/db.js";
import { encrypt } from "../extra/encrypt.js";
export async function saveChatHistory({ email, question, aiAnswer, type, sql = null, dbRows = [] }) {
    try {
        const query = `
      INSERT INTO chat_history (user_email, question, ai_answer, message, db_sql, db_rows)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
        await pool.execute(query, [
            email,
            encrypt(question),
            encrypt(aiAnswer),
            encrypt(type),
            sql,
            JSON.stringify(dbRows),
        ]);
        // await addToVectorStore({
        //     question,
        //     answer: aiAnswer,
        //     email,
        //     type
        // });
        // console.log("✅ Vector stored:", question, "| type:", type);
    } catch (err) {
        console.error("❌ Save chat history failed:", err.message);
    }
}
