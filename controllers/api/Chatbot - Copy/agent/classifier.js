import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import productModel from "../../../../models/Product.js";
import chatbotModel from "../../../../models/Chatbot.js";
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-4o",
    temperature: 0.3,
});
export async function intentClassifier({ messages, email }) {
    const pastMessages = await chatbotModel.findByEmail(email);

    const lastMsg = messages[messages.length - 1]?.content;

    const products = await productModel.getAll();

    const productList = products
        .map(p => `${p.name} (giá ${p.price}đ)`)
        .join(", ");

    const intent = await model.invoke([
        ["system", `
            Bạn là bộ phân loại intent. Hãy phân loại câu hỏi khách thành 1 trong 4 nhóm: 
- **consult**: khách muốn tư vấn chọn sản phẩm phù hợp với nhu cầu.
- **sql**: khách muốn truy vấn dữ liệu (liệt kê đơn hàng, sản phẩm giảm giá, sản phẩm đã mua...).
- **cancel**: khách muốn hủy đơn hàng.
- **policy**: khách hỏi về chính sách đổi trả, giao hàng, bảo hành.

Đây là lịch sử trò chuyện của bạn với khách hàng:
${pastMessages.map(m => {
            const speaker = m.role === "user" ? "KH" : "AI";
            return `${speaker}: ${m.content}\nType: ${m.type}`;
        }).join("\n\n")}

Dựa vào lịch sử trò chuyện giữa người dùng và bạn trả về duy nhất 1 từ: consult, sql, policy, hoặc cancel.

Sản phẩm đang bán: ${productList}
`],
        ["human", `Câu hỏi của khách: "${lastMsg}", Email của khách: "${email}". Chỉ trả về 1 từ: consult, sql, policy hoặc cancel.`]
    ]);

    const result = intent.content?.trim().toLowerCase();
    console.log("Guest question:", lastMsg);
    console.log("🟨 Raw AI intent result:", intent.content);
    console.log("✅ Parsed intent:", result);

    return {
        messages,
        next: result
    };
}