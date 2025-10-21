//CANCELAGENT
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import pool from "../../../../models/db.js";
import { model } from "../../../../controllers/api/Chatbot/llm.js";
import { pushLog } from "../extra/sseLogs.js";

const cancelPrompt = ChatPromptTemplate.fromMessages([
    ["system", `
Bạn là trợ lý AI xử lý yêu cầu hủy đơn hàng.

======== QUY TẮC TRẢ VỀ ========
- Nếu khách muốn thay đổi địa chỉ giao hàng hoặc thông tin vận chuyển: ➜ Trả về: CHANGE_ADDRESS
- Nếu khách muốn thay đổi thông tin cá nhân: ➜ Trả về: CHANGE_PERSONAL
- Nếu khách muốn đặt hàng: ➜ Trả về: CHECK_OUT
- Nếu khách muốn hủy đơn hàng (bằng chữ hoặc số): ➜ Trả về: HUY <mã đơn>
- Nếu khách xác nhận hủy: ➜ Trả về: CONFIRM <mã đơn>
- Nếu khách từ chối hủy: ➜ Trả về: CANCEL
- Nếu không hiểu câu hỏi: ➜ Trả về: UNKNOWN

======== VÍ DỤ CHUẨN ========
Khách: "Tôi muốn hủy đơn hàng 13", "Huỷ đơn 123", exc. ➜ CHECK_OUT  
Khách: "Tôi muốn đặt hàng", "Check out", exc. ➜ HUY 13  
Khách: "Tôi muốn xác nhận huỷ đơn hàng số 10 với email abc@gmail.com" ➜ CONFIRM 10 email: abc@gmail.com  
Khách: "[XÁC NHẬN HỦY ĐƠN HÀNG SỐ 9 của email: xyz@gmail.com]" ➜ CONFIRM 9 email: xyz@gmail.com 
Khách: "[KHÔNG HỦY ĐƠN HÀNG SỐ 9]" ➜ CANCEL  
Khách: "Tôi cần tư vấn thêm" → UNKNOWN
        `],
    new MessagesPlaceholder("messages")
]);

const cancelChain = RunnableSequence.from([cancelPrompt, model]);

export async function cancelAgent({ messages, email, history, session_id }) {
    const logKey = email || session_id;
    const log = (msg, step = null) => pushLog(logKey, { msg, step });
    const response = await cancelChain.invoke({ messages, history });
    const result = response.content.trim();

    console.log("result", result);

    const confirmMatch = result.match(/^CONFIRM (\d+)/i);
    const huyMatch = result.match(/^HUY (\d+)/i);
    const isChangeAddress = result.trim() === "CHANGE_ADDRESS";
    const isChangePersonal = result.trim() === "CHANGE_PERSONAL";
    const isCheckOut = result.trim() === "CHECK_OUT";

    log("Kiểm tra định danh khách hàng", "personal");

    if (confirmMatch) {
        const orderId = confirmMatch[1];

        // Extract email từ tin nhắn user
        const emailMatch = messages.at(-1).content.match(
            /email[:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
        );
        const providedEmail = emailMatch ? emailMatch[1] : null;

        // Xác thực email
        if (!providedEmail || providedEmail.toLowerCase() !== email.toLowerCase()) {
            const aiAnswer = `❌ Email xác nhận không khớp với tài khoản. Vui lòng nhập lại đúng email đã đặt hàng.`;
            return { messages: [{ role: "ai", content: aiAnswer }] };
        }

        try {
            // Lấy đơn hàng và trạng thái
            const [orderRows] = await pool.execute(
                "SELECT o.*, s.name as status_name, s.id as status_id " +
                "FROM `order` o JOIN status s ON o.order_status_id = s.id " +
                "WHERE o.id = ?",
                [orderId]
            );

            const order = orderRows[0];
            if (!order) {
                return { messages: [{ role: "ai", content: `❌ Không tìm thấy đơn hàng #${orderId}.` }] };
            }

            // Kiểm tra trạng thái
            if (order.status_name === "delivered" || order.status_name === "canceled") {
                return { messages: [{ role: "ai", content: `❌ Đơn hàng #${orderId} hiện ở trạng thái "${order.status_name}", không thể hủy.` }] };
            }

            // Nếu đang packaging (id = 3) → hoàn lại kho
            if (order.status_id === 3) {
                const [items] = await pool.execute(
                    "SELECT product_id, qty FROM order_item WHERE order_id = ?",
                    [orderId]
                );
                for (const item of items) {
                    await pool.execute(
                        "UPDATE product SET inventory_qty = inventory_qty + ? WHERE id = ?",
                        [item.qty, item.product_id]
                    );
                }
            }

            // Hủy đơn
            await pool.execute(
                "UPDATE `order` SET order_status_id = 6 WHERE id = ?",
                [orderId]
            );

            // (Optional) gửi mail xác nhận hủy — có thể dùng nodemailer ở đây
            // await sendCancelEmail(providedEmail, orderId, reasonText);

            const aiAnswer = `✅ Đã hủy đơn hàng số ${orderId} thành công. Chúc quý khách một ngày tốt lành.`;
            return { messages: [{ role: "ai", content: aiAnswer }] };
        } catch (err) {
            return { messages: [{ role: "ai", content: `❌ Lỗi khi hủy đơn: ${err.message}` }] };
        }
    }


    if (huyMatch) {
        const orderId = huyMatch[1];
        const aiAnswer = `Bạn có chắc muốn hủy đơn hàng số ${orderId} không ?\nVui lòng xác nhận bằng copy 1 trong 2 lựa chọn:    [XÁC NHẬN HỦY ĐƠN HÀNG SỐ ${orderId} của 'email:...' ] hoặc  [KHÔNG HỦY]`;
        return { messages: [{ role: "ai", content: aiAnswer }] };
    }

    if (isChangeAddress) {
        const aiAnswer = `
📦 Bạn có thể thay đổi địa chỉ giao hàng tại đây:<br/>
👉 <a href="${process.env.FRONTEND_URL_NEXT}/tai-khoan/dia-chi-giao-hang-mac-dinh" target="_blank" style="color: #1D4ED8; text-decoration: underline;">
Thay đổi địa chỉ giao hàng mặc định
</a>
    `.trim();

        return { messages: [{ role: "ai", content: aiAnswer }] };
    }

    if (isChangePersonal) {
        const aiAnswer = `
📦 Bạn có thể thay đổi thông tin cá nhân tại đây:<br/>
👉 <a href="${process.env.FRONTEND_URL_NEXT}/tai-khoan/thong-tin" target="_blank" style="color: #1D4ED8; text-decoration: underline;">
Thay đổi thông tin cá nhân
</a>
    `.trim();

        return { messages: [{ role: "ai", content: aiAnswer }] };
    }

    if (isCheckOut) {
        const aiAnswer = `
📦 Bạn có thể đặt hàng tại đây:<br/>
👉 <a href="${process.env.FRONTEND_URL_NEXT}/dat-hang" target="_blank" style="color: #1D4ED8; text-decoration: underline;">
Đặt hàng
</a>
    `.trim();

        return { messages: [{ role: "ai", content: aiAnswer }] };
    }

    if (result === "CANCEL") {
        const aiAnswer = "Chúc quý khách một ngày tốt lành.";
        return { messages: [{ role: "ai", content: aiAnswer }] };
    }

    const fallback = "Xin hãy cung cấp mã đơn hàng cần hủy, ví dụ: 'hủy đơn hàng số 123'";

    if (aiAnswer && aiAnswer.trim()) {
        await saveChatHistory({
            email,
            session_id,
            role: "ai",
            content: aiAnswer,
        });
    }
    return { messages: [{ role: "ai", content: fallback }] };
}