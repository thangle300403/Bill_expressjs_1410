import pool from "../../../../../../models/db.js";
import { saveChatHistory } from "../../../memory/saveChatHistory.js";

export async function executeCancel(state) {
    const orderId = state.orderId;
    const email = state.temp_email;

    try {
        await pool.execute("UPDATE `order` SET order_status_id = 6 WHERE id = ?", [orderId]);

        const aiAnswer = `✅ Đã hủy đơn hàng số ${orderId} thành công. Chúc quý khách một ngày tốt lành.`;

        await saveChatHistory({
            email,
            question: state.messages.at(-1)?.content ?? "",
            aiAnswer,
            type: "cancel",
            sql: `UPDATE order SET order_status_id = 6 WHERE id = ${orderId}`,
            dbRows: [],
        });

        return {
            ...state,
            messages: [...state.messages, { role: "ai", content: aiAnswer }],
            current_step: "__end__",
        };
    } catch (err) {
        const errorMsg = `❌ Lỗi khi hủy đơn: ${err.message}`;
        return {
            ...state,
            messages: [...state.messages, { role: "ai", content: errorMsg }],
            current_step: "__end__",
        };
    }
}
