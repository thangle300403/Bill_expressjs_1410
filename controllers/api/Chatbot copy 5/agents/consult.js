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
Bạn là trợ lý AI tư vấn về nhu cầu người chơi về cầu lông của shop, chỉ và chỉ về nhu cầu người chơi về cầu lông thôi.
Am hiểu tất cả những kiến thức về cầu lông.
Trả lời ngắn gọn, thân thiện.
Chỉ tư vấn các sản phẩm liên quan đến câu hỏi khách.
Gợi ý đúng trình độ người chơi và giá hợp lý.
Nếu khách hỏi mơ hồ, hãy hỏi lại rõ nhu cầu.
- Sau khi tư vấn, HÃY GỢI Ý một câu hỏi tiếp theo để khách có muốn mua sản phẩm 
    (vd: Bạn có muốn thêm sản phẩm ... vào giỏ hàng hay tìm kiểu thêm sản phẩm)

Đôi lúc không cần sử dụng tool chỉ tư vấn, 

== Dữ liệu ==
Sản phẩm đang bán: {productList}, vì đôi lúc khách hàng có thể điền sai chính tả sản phẩm.
Dựa vào lịch sử giao tiếp (ở database) để đưa câu trả lời đúng hơn: {historyFormatted}.
Lịch sử có embedingvector gần giống nhất: {context}
Tool đã dùng: {usedTools}
Tool có sẵn: {availableTools}
matchedProdInUserQues: {matchedProdInUserQues}
Nếu 'matchedProdInUserQues' KHÔNG RỖNG, nghĩa là sản phẩm đó chắc chắn CÓ TRONG KHO, KHÔNG được trả lời rằng KHÔNG có hoặc HẾT HÀNG.

== Nhiệm vụ bổ sung ==
Dựa vào toàn bộ thông tin ở trên, hãy phân tích xem khách có cần:
- current_step = "add_to_cart" (Khách muốn thêm vào giỏ hàng và danh sách 'matchedProdInUserQues' có sản phẩm)
- current_step = "intent" (Khi không có sử dụng thêm tool nào)
1 tool chỉ được dùng duy nhất 1 lần (Chỉ chọn tool không có trong danh sách usedTools)

== Hướng dẫn quan trọng ==
- Nếu bạn chỉ tư vấn: trả lời dưới dạng VĂN BẢN BÌNH THƯỜNG, KHÔNG bọc JSON.
- Nếu bạn muốn khách hàng thêm vào giỏ hàng: trả lời bằng ĐÚNG CÚ PHÁP JSON như sau:
{{  
  "response": "<câu trả lời>",  
  "current_step": "add_to_cart"  
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

        const matchedProdInUserQues = products.filter(p =>
            userQuestion.toLowerCase().includes(p.name?.toLowerCase() || "")
        );

        if (matchedProdInUserQues.length > 0) {
            console.log("🚧 matchedProdInUserQues:", matchedProdInUserQues[0].name);
        } else {
            console.log("🚧 matchedProdInUserQues: Không có sản phẩm khớp");
        }

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

        const similar = await searchSimilar(userQuestion, 5, 0.7, "consult_docs");
        const context = similar.map(doc =>
            `KH: ${doc.pageContent}\nAI: ${doc.metadata.answer}`
        ).join("\n");

        const response = await consultChain.invoke({
            messages,
            productList,
            historyFormatted,
            context,
            usedTools,
            availableTools,
            matchedProdInUserQues: matchedProdInUserQues.map(p => `${p.name} (giá ${p.price}đ)`).join(", "),
        });

        const raw = response.content.trim();
        // if model requests a tool already used, override to intent
        // if (usedTools.includes(parsed.current_step)) {
        //     parsed.current_step = "intent";
        // }

        let parsed, aiText;

        try {
            parsed = JSON.parse(raw);
            aiText = parsed.response;

            if (usedTools.includes(parsed.current_step)) {
                console.warn(`⚠️ Tool "${parsed.current_step}" was already used. Downgrading to "intent".`);
                parsed.current_step = "intent";
            }
        } catch (e) {
            console.warn("⚠️ Not valid JSON. Treating as plain text response.");
            parsed = { current_step: "intent" };
            aiText = raw;
        }

        const matched = products.filter(p =>
            aiText.toLowerCase().includes(p.name.toLowerCase())
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
            aiAnswer: aiText + productDetailUrls,
            type: "consult",
            sql: null,
            dbRows: []
        });

        console.log("Consult agent: curent_step:", parsed.current_step);
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
                {
                    role: "ai",
                    content: aiText + productDetailUrls,
                    additional_kwargs: { tag: "consult_reply" },
                }
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
            current_step: "intent",
            error: "consultAgent failed: " + error.message,
        };
    }
}