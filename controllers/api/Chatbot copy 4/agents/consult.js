//CONSULTAGENT
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import productModel from "../../../../models/Product.js";
import slugify from "slugify";
import { saveChatHistory } from "../memory/saveChatHistory.js";
import { searchSimilar } from "../vectorStore.js";
import aiChatbotModel from "../../../../models/Chatbot.js";
import { encrypt } from "../extra/encrypt.js";
import { getVectorStore } from "../vectorStore.js";
import { model } from "../../../../controllers/api/Chatbot/llm.js";


const consultPromptTemplate = ChatPromptTemplate.fromMessages([
    ["system", `
Bạn là trợ lý AI tư vấn cầu lông của shop.
Am hiểu tất cả những kiến thức về cầu lông.
Trả lời ngắn gọn, thân thiện.
Chỉ tư vấn các sản phẩm liên quan đến câu hỏi khách.
Gợi ý đúng trình độ người chơi và giá hợp lý.
Nếu khách hỏi mơ hồ, hãy hỏi lại rõ nhu cầu.
- Sau khi tư vấn, HÃY GỢI Ý một câu hỏi tiếp theo để hỗ trợ thêm 

== Dữ liệu ==
Sản phẩm đang bán: {productList}, vì đôi lúc khách hàng có thể điền sai chính tả sản phẩm.
Dựa vào lịch sử giao tiếp (ở database) để đưa câu trả lời đúng hơn: {historyFormatted}.
Lịch sử có embedingvector gần giống nhất: {context}
Tool đã dùng: {usedTools}
Tool có sẵn: {availableTools}

== Nhiệm vụ bổ sung ==
Dựa vào toàn bộ thông tin ở trên, hãy phân tích xem khách có cần:
- current_step = "add_to_cart" (Khách muốn thêm vào giỏ hàng)
- current_step = "intent" (Khi không có sử dụng thêm tool nào)
1 tool chỉ được dùng duy nhất 1 lần (Chỉ chọn tool không có trong danh sách usedTools)

== Trả về dạng JSON đúng cú pháp như sau ==
{{
"response": "<câu trả lời>",
"current_step": "<step>"
    }}
`],
    new MessagesPlaceholder("messages"),
]);

const consultChain = RunnableSequence.from([consultPromptTemplate, model]);

export async function consultAgent({ messages, email, history, intent, answered_intents = [], original_user_msg, used_tool, cartProduct }) {
    try {
        console.log("🚧 !!!!!!!! Now we enter:", intent);
        await getVectorStore("consult_docs");

        const toolList = ["add_to_cart"];
        const usedTools = Array.isArray(used_tool) ? used_tool : (used_tool ? [used_tool] : []);
        console.log("🚧 usedTools:", usedTools);
        const availableTools = toolList.filter(t => !usedTools.includes(t)).join(", ");

        const userQuestion = messages.at(-1)?.content || "";

        const products = await productModel.getAll();

        const productList = products
            .map(p => `${p.name} (giá ${p.price}đ)`)
            .join(", ");

        const rawHistory = await aiChatbotModel.findByEmail(email);

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

        console.log("✅ Rebuilt historyFormatted from mysql");

        const similar = await searchSimilar(userQuestion, 5, 0.7, "consult_docs");
        const context = similar.map(doc =>
            `KH: ${doc.pageContent}\nAI: ${doc.metadata.answer}`
        ).join("\n");

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
            usedTools,
            availableTools,
        });

        const parsed = JSON.parse(response.content);
        // if model requests a tool already used, override to intent
        if (usedTools.includes(parsed.current_step)) {
            parsed.current_step = "intent";
        }
        const aiText = parsed.response;

        console.log("✅consult aiText");

        // Auto-match product names mentioned in AI response
        const matched = products.filter(p =>
            aiText.toLowerCase().includes(p.name.toLowerCase())
        );
        if (!matched.length) {
            throw new Error("❌ No matched product found, but one was expected.");
        }
        console.log("🛒 Match product:", matched[0].name);

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
            aiAnswer: aiText + productDetailUrls,
            type: "consult",
            sql: null,
            dbRows: []
        });

        console.log("curent_step:", parsed.current_step);
        // normalize and accumulate answered intents without duplicates
        const prevAnswered = Array.isArray(answered_intents)
            ? answered_intents
            : answered_intents
                ? [answered_intents]
                : [];
        const newAnswered = [...new Set([...prevAnswered, "consult"])];
        // normalize and accumulate used tools without duplicates
        const prevUsed = Array.isArray(used_tool)
            ? used_tool
            : used_tool
                ? [used_tool]
                : [];
        const newUsedTools = [...new Set([...prevUsed, parsed.current_step])];

        return {
            messages: [
                ...messages,
                { role: "ai", content: aiText + productDetailUrls }
            ],
            answered_intents: newAnswered,
            current_step: parsed.current_step,
            used_tool: newUsedTools,
            cartProduct: ["add_to_cart"].includes(parsed.current_step)
                ? { product: matched[0], quantity: 1 }
                : undefined,
        };

    } catch (error) {
        console.error("❌ consultAgent failed:", error.message);
        return {
            current_step: "planner",
            error: "consultAgent failed: " + error.message,
        };
    }
}