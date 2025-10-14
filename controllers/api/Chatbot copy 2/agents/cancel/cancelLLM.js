import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({ temperature: 0.2, modelName: "gpt-4o" });

const prompt = ChatPromptTemplate.fromMessages([
    [
        "system",
        `
Bạn là trợ lý hủy đơn hàng.

🎯 Mục tiêu: Tìm và trích xuất "email" và "mã đơn hàng (orderId)" từ hội thoại của người dùng.

📥 Đầu vào: danh sách tin nhắn trước đó (tin nhắn của user và bot).

📤 Đầu ra: chỉ trả về chuỗi JSON hợp lệ có 2 field: "email" và "orderId". Nếu không có, trả về null cho field đó
🚫 KHÔNG trả lời gì thêm ngoài JSON.
    `,
    ],
    new MessagesPlaceholder("messages"),
]);


const chain = prompt.pipe(model).pipe(async (output) => {
    try {
        console.log("Chain");
        console.log("Output:", output.content);
        const json = JSON.parse(output.content);
        console.log("JSON:", json);
        return {
            email: json.email,
            orderId: json.orderId,
            messages: output.response_messages,
        };
    } catch {
        return { messages: output.response_messages };
    }
});

export async function cancelLLM(state) {
    console.log("📍 Entered: cancelLLM");
    const result = await chain.invoke({ messages: state.messages });

    return {
        ...state,
        temp_email: result.email ?? state.temp_email,
        orderId: result.orderId ?? state.orderId,
        messages: [...state.messages, ...(result.messages || [])],
        current_step: "CheckInfo",
    };
}
