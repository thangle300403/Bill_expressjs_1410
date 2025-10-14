//CANCELAGENT
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import pool from "../../../../models/db.js";
import { saveChatHistory } from "../memory/saveChatHistory.js";
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-4o",
    temperature: 0.3,
});

const cancelPrompt = ChatPromptTemplate.fromMessages([
    ["system", `
Bạn là trợ lý AI xử lý yêu cầu hủy đơn hàng.

======== QUY TẮC TRẢ VỀ ========
- Nếu khách muốn hủy đơn hàng (bằng chữ hoặc số): ➜ Trả về: **HUY <mã đơn>**
- Nếu khách xác nhận hủy: ➜ Trả về: **CONFIRM <mã đơn>**
- Nếu khách từ chối hủy: ➜ Trả về: **CANCEL**
- Nếu không hiểu câu hỏi: ➜ Trả về: **UNKNOWN**

======== VÍ DỤ CHUẨN ========
Khách: "Tôi muốn hủy đơn hàng 13", "Huỷ đơn 123", exc. ➜ HUY 13  
Khách: "Tôi muốn xác nhận huỷ đơn hàng số 10" ➜ CONFIRM 10  
Khách: "[XÁC NHẬN HỦY ĐƠN HÀNG SỐ 9]" ➜ CONFIRM 9  
Khách: "[KHÔNG HỦY ĐƠN HÀNG SỐ 9]" ➜ CANCEL  
Khách: "Tôi cần tư vấn thêm" → UNKNOWN

Lịch sử giao tiếp (Nếu có): {history}
        `],
    new MessagesPlaceholder("messages")
]);

const cancelChain = RunnableSequence.from([cancelPrompt, model]);

export async function cancelAgent({ messages, email, history }) {
    const response = await cancelChain.invoke({ messages, history });
    const result = response.content.trim();

    const confirmMatch = result.match(/^CONFIRM (\d+)/i);
    const huyMatch = result.match(/^HUY (\d+)/i);

    if (confirmMatch) {
        const orderId = confirmMatch[1];
        try {
            await pool.execute("UPDATE `order` SET order_status_id = 6 WHERE id = ?", [orderId]);

            const aiAnswer = `✅ Đã hủy đơn hàng số ${orderId} thành công.Chúc quý khách một ngày tốt lành.`;
            await saveChatHistory({ email, question: messages.at(-1).content, aiAnswer, type: "cancel", sql: `UPDATE order SET order_status_id = 6 WHERE id = ${orderId}`, dbRows: [] });

            return { messages: [{ content: aiAnswer }] };
        } catch (err) {
            return { messages: [{ content: `❌ Lỗi khi hủy đơn: ${err.message}` }] };
        }
    }

    if (huyMatch) {
        const orderId = huyMatch[1];
        const aiAnswer = `Bạn có chắc muốn hủy đơn hàng số ${orderId} không ?\nVui lòng xác nhận bằng: [XÁC NHẬN HỦY ĐƠN HÀNG SỐ ${orderId}] hoặc[KHÔNG HỦY]`;

        await saveChatHistory({ email, question: messages.at(-1).content, aiAnswer, type: "cancel", sql: null, dbRows: [] });

        return { messages: [{ content: aiAnswer }] };
    }

    if (result === "CANCEL") {
        const aiAnswer = "Chúc quý khách một ngày tốt lành.";
        await saveChatHistory({ email, question: messages.at(-1).content, aiAnswer, type: "cancel", sql: null, dbRows: [] });
        return { messages: [{ content: aiAnswer }] };
    }

    const fallback = "Xin hãy cung cấp mã đơn hàng cần hủy, ví dụ: 'hủy đơn hàng số 123'";
    await saveChatHistory({ email, question: messages.at(-1).content, aiAnswer: fallback, type: "cancel", sql: null, dbRows: [] });
    return { messages: [{ content: fallback }] };
}