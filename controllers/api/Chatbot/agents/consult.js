// CONSULT AGENT — PURE CONSULT VERSION (no tools)
import { ChatMessagePromptTemplate, ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { model } from "../../../../controllers/api/Chatbot/llm.js";
import { pushLog } from "../extra/sseLogs.js";
import dotenv from "dotenv";
import { getProductCache } from "../cache/productCache.js";
import { searchSimilarConsult } from "../vectorStore.js";
import { saveChatHistory } from "../memory/saveChatHistory.js";
import { searchSimilar } from "../vectorStore.js";
import { findProductMatches } from "../extra/findProductMatches.js";
dotenv.config();

const consultPromptTemplate = ChatPromptTemplate.fromMessages([
    [
        "system",
        `
Bạn là trợ lý AI chuyên tư vấn sản phẩm cầu lông.
Chỉ thực hiện nhiệm vụ tư vấn (KHÔNG sử dụng hay gọi bất kỳ tool nào).

Quy tắc:
1. Tư vấn chi tiết và thân thiện, bằng tiếng Việt.
2. Luôn tham khảo lịch sử hội thoại để duy trì ngữ cảnh, không hỏi lại thông tin khách đã cung cấp.
3. Không được nói về chính sách, hủy đơn, hoặc giá sản phẩm — các phần đó do hệ thống khác phụ trách.
4. Nếu khách hỏi mơ hồ, hãy hỏi lại để làm rõ nhu cầu (ví dụ: trọng lượng, cấp độ chơi).
5. Luôn đưa ra gợi ý sản phẩm hoặc loại sản phẩm phù hợp dựa trên ngữ cảnh.
6. Cuối câu nên gợi mở (“Bạn có muốn mình gợi ý thêm vài mẫu không?”).

== Dữ liệu tham khảo ==
- Danh sách sản phẩm: {productList}
- Lịch sử hội thoại: {historyFormatted}
- Ngữ cảnh sản phẩm (semantic context): {productContext}

Trả lời ngắn gọn, thân thiện, hoàn toàn bằng tiếng Việt, không định dạng JSON.
`
    ],
    new MessagesPlaceholder("messages"),
]);

const consultChain = RunnableSequence.from([consultPromptTemplate, model]);

function containsProductKeyword(text) {
    if (!text) return false;
    const lower = text.toLowerCase();

    const productKeywords = [
        // thương hiệu
        "yonex", "lining", "victor", "mizuno", "apacs", "kawasaki",
        "sản phẩm",
        // nhóm sản phẩm
        "vợt", "racket", "giày", "shoes", "áo", "shirt", "quần", "pants",
        "túi", "bag", "dây cước", "string", "grip",
        // model phổ biến
        "astrox", "duora", "arcsaber", "nanoflare", "power cushion",
    ];

    return productKeywords.some(keyword => lower.includes(keyword));
}


export async function consultAgent({
    messages,
    email,
    history,
    session_id,
    intent,
    answered_intents = [],
    original_user_msg,
}) {
    try {
        const userQuestion = original_user_msg;
        const logKey = email || session_id;
        const log = (msg, step = null) => pushLog(logKey, { msg, step });

        log("🎯 Trợ lý đang tư vấn", "consult");

        // Lấy dữ liệu sản phẩm từ cache
        const products = await getProductCache();
        const productList = products
            .map((p) => `${p.name} (giá ${p.price}đ)`)
            .join(", ");

        // Lấy ngữ cảnh sản phẩm từ vector store
        let similarProducts = [];

        if (containsProductKeyword(userQuestion)) {
            console.log("🔍 Detect product keyword in user question → running searchSimilarConsult");
            similarProducts = await searchSimilarConsult(
                userQuestion,
                5,
                0.5,
                "product_descriptions"
            );
        } else {
            console.log("⚠️ No product keyword found in user question → skip search");
            // optional: reuse previous product context
            similarProducts = [];
        }

        const productContext = similarProducts
            .map((doc, idx) => `#${idx + 1} ${doc.pageContent}`)
            .join("\n");

        // Format lịch sử hội thoại
        const historyFormatted = (history || [])
            .map((msg, idx) => {
                if (msg.role === "user") {
                    const next = history[idx + 1];
                    if (next?.role === "ai") {
                        return `KH: ${msg.content}\nAI: ${next.content}`;
                    }
                }
                return null;
            })
            .filter(Boolean)
            .join("\n");

        // Tạo prompt & gọi model
        const response = await consultChain.invoke({
            messages,
            productList,
            historyFormatted,
            productContext,
        });

        const aiText = response.content.trim();
        log(`🧠 AI trả lời: ${aiText}`, "consult-done");

        const { matched, productDetailUrls } = findProductMatches(aiText, products);

        // Lưu lại lịch sử hội thoại
        await saveChatHistory({
            email,
            session_id,
            role: "ai",
            content: aiText + productDetailUrls,
        });

        const prevAnswered = Array.isArray(answered_intents)
            ? answered_intents
            : answered_intents
                ? [answered_intents]
                : [];
        const newAnswered = [...new Set([...prevAnswered, "consult"])];

        return {
            messages: [
                ...messages,
                {
                    role: "ai",
                    content: aiText + productDetailUrls,
                    additional_kwargs: { tag: "consult_reply" },
                },
            ],
            answered_intents: newAnswered,
            current_step: "intent", // ✅ luôn quay về intent
        };
    } catch (error) {
        console.error("❌ consultAgent failed:", error.message);
        return {
            current_step: "intent",
            error: "consultAgent failed: " + error.message,
        };
    }
}
