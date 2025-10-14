import productModel from "../../../../models/Product.js";
import chatbotModel from "../../../../models/Chatbot.js";
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-4o",
    temperature: 0.2, // low temp for consistency
});

let loopCount = 0;

export async function intentClassifier({
    messages,
    email,
    answered_intents = [],
    original_user_msg,
}) {
    loopCount++;

    // const pastMessages = await chatbotModel.findByEmail(email);

    // Always classify from original question, not AI's last message
    const userQuestion = original_user_msg || (
        [...messages].reverse().find(m => (m.role || "").toLowerCase() === "user")?.content
    ) || "";

    // Last AI answer if exists
    const lastAiAnswer =
        [...messages].reverse().find(m => (m.role || "").toLowerCase() === "ai")?.content || "";

    console.log(`\intentClassifier Loop Back Count: ${loopCount}`);
    console.log("🌀 intentClassifier called. Question:", userQuestion);
    console.log("✅ intentClassifier Already answered intents:", answered_intents);

    const products = await productModel.getAll();
    const productList = products.map(p => `${p.name} (giá ${p.price}đ)`).join(", ");

    const prompt = [
        [
            "system",
            `
Bạn là bộ phân loại intent cho trợ lý AI.
Bạn sẽ quyết định bước tiếp theo dựa trên:
- Câu hỏi gốc của khách
- Danh sách các intent đã trả lời
- Câu trả lời AI gần nhất

Các intent hợp lệ:
- consult: khách muốn tư vấn chọn sản phẩm
- sql: khách muốn truy vấn dữ liệu từ hệ thống (ví dụ: giá cả, thông tin sản phẩm, tình trạng đơn hàng, trạng thái vận chuyển, chi tiết hóa đơn, ...).
- cancel: khách muốn hủy đơn hàng
- policy: khách hỏi về chính sách
- __end__: khi tất cả ý trong câu hỏi gốc đã được trả lời

QUY TẮC:
1. Nếu câu hỏi chứa nhiều ý, hãy lần lượt chọn intent CHƯA CÓ trong danh sách đã trả lời (Không phải answered_intent), theo thứ tự xuất hiện trong câu.
2. Nếu bạn nghĩ tất cả các ý đã được trả lời, trả về "__end__".
3. Chỉ trả về đúng 1 từ trong 5 giá trị trên. Không giải thích, không thêm ký tự khác.
`
        ],
        [
            "human",
            `
Câu hỏi gốc: "${userQuestion}"
Các intent đã trả lời (answered_intent): ${answered_intents.length ? answered_intents.join(", ") : "(chưa có)"}
Câu trả lời AI gần nhất: "${lastAiAnswer}"
Sản phẩm đang bán: ${productList}
`
        ]
    ];

    const intent = await model.invoke(prompt);
    let raw = (intent.content || "").trim().toLowerCase();
    console.log("🟨 Classifier Raw AI intent result:", raw);
    return {
        messages,
        next: raw,
        answered_intents,
        original_user_msg: userQuestion
    };
}
