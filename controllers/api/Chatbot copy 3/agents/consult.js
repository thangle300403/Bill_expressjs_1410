//CONSULTAGENT
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import productModel from "../../../../models/Product.js";
import slugify from "slugify";
import { saveChatHistory } from "../memory/saveChatHistory.js";
import { searchSimilar } from "../vectorStore.js";
import aiChatbotModel from "../../../../models/Chatbot.js";
import { encrypt } from "../extra/encrypt.js";
import { ChatOpenAI } from "@langchain/openai";
import { getVectorStore } from "../vectorStore.js";

const model = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-4o",
    temperature: 0.3,
});

const consultPromptTemplate = ChatPromptTemplate.fromMessages([
    ["system", `
Bạn là trợ lý AI tư vấn cầu lông của shop.
Am hiểu tất cả những kiến thức về cầu lông.
Trả lời ngắn gọn, thân thiện.
Chỉ tư vấn các sản phẩm liên quan đến câu hỏi khách.
Gợi ý đúng trình độ người chơi và giá hợp lý.
Nếu khách hỏi mơ hồ, hãy hỏi lại rõ nhu cầu.
- Sau khi tư vấn, HÃY GỢI Ý một câu hỏi tiếp theo để hỗ trợ thêm (VD: “Anh/chị cần thêm gợi ý về giày hoặc phụ kiện không?”)

Sản phẩm đang bán: {productList}

lịch sử giao tiếp (ở database): {historyFormatted}, có thể dựa vào đây để sửa lỗi của bạn.
Lịch sử có embedingvector gần giống nhất: {context}

Sau mỗi câu trả lời, hãy quyết định xem bạn nên tiếp tục tư vấn hay kết thúc intent này.

Cách quyết định:
- Nếu người dùng vẫn đang hỏi về sản phẩm, còn do dự, đang so sánh, hoặc hỏi thêm → tiếp tục tư vấn (exit = false)
- Nếu người dùng kết thúc, chuyển chủ đề, hoặc không còn quan tâm → kết thúc (exit = true)

Luôn trả về JSON như sau:
{
  "reply": "tin nhắn bạn muốn gửi",
  "exit": true hoặc false
}
  `],
    new MessagesPlaceholder("messages"),
]);

const consultChain = RunnableSequence.from([consultPromptTemplate, model]);

export async function consultAgent({ messages, email, history, intent, answered_intents = [], original_user_msg }) {
    try {
        console.log("🚧 consultBudd running !!!!!!!!!!!!! ");
        await getVectorStore("consult_docs");
        const userQuestion = messages.at(-1)?.content || "";

        console.log("🚧 consult intent:", intent);

        const products = await productModel.getAll();

        const productList = products
            .map(p => `${p.name} (giá ${p.price}đ)`)
            .join(", ");

        const encryptedMessage = encrypt(intent);
        const rawHistory = await aiChatbotModel.findByMessageAndEmail(encryptedMessage, email);

        // console.log("... Rebuilding Chroma from DB");

        // for (const row of rawHistory) {
        //     await addToVectorStore({
        //         question: row.question,
        //         answer: row.ai_answer,
        //         email,
        //         type: intent,
        //     }, "consult_docs");
        // }

        // console.log("✅ Rebuilt Chroma memory from DB");

        const historyFormatted = rawHistory.map(row => {
            return `KH: ${row.question}\nAI: ${row.ai_answer}`;
        }).join("\n");

        const similar = await searchSimilar(userQuestion, 5, 0.7, "consult_docs");
        const context = similar.map(doc =>
            `KH: ${doc.pageContent}\nAI: ${doc.metadata.answer}`
        ).join("\n");

        console.log("✅consult context");

        // const response = await consultChain.invoke({
        //     messages,
        //     productList,
        //     historyFormatted,
        // });
        const response = await consultChain.invoke({
            messages,
            productList,
            historyFormatted,
            context,
        });

        const reply = response.content;
        let exit = true;

        try {
            const parsed = JSON.parse(response.content);
            reply = parsed.reply;
            exit = parsed.exit;
        } catch (err) {
            console.warn("❌ Failed to parse JSON, assuming exit = true");
        }

        console.log("✅consult reply");

        // Auto-match product names mentioned in AI response
        const matched = products.filter(p =>
            reply.toLowerCase().includes(p.name.toLowerCase())
        );

        let productDetailUrls = "";
        if (matched.length > 0) {
            const urls = matched.map(p => {
                const slug = slugify(p.name, { lower: true });
                const url = `${process.env.FRONTEND_URL_NEXT}/san-pham/${slug}-${p.id}`;
                return `[${p.name}](${url})`;
            });
            productDetailUrls = `\n📦 Xem chi tiết:\n${urls.join("\n")}`;
        }

        console.log("✅consult product url:", productDetailUrls);

        await saveChatHistory({
            email,
            question: original_user_msg || "",
            aiAnswer: reply + productDetailUrls,
            type: "consult",
            sql: null,
            dbRows: []
        });

        return {
            messages: [
                ...messages,
                { role: "ai", content: reply + productDetailUrls }
            ],
            answered_intents: [...(answered_intents || []), "consult"],
            current_step: exit ? "intent" : "consult",
        };
    } catch (error) {
        console.error("❌ consultAgent failed:", error.message);
        return {
            current_step: "planner",
            error: "consultAgent failed: " + error.message,
        };
    }
}