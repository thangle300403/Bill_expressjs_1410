import productModel from "../../../../models/Product.js";
import aiChatbotModel from "../../../../models/Chatbot.js";
import { model } from "../../../../controllers/api/Chatbot/llm.js";
import { searchSimilar } from "../vectorStore.js";
import { pushLog } from "../extra/sseLogs.js";
import { getProductCache } from "../cache/productCache.js";
import { addToCartTool, matchProductTool } from "../nodes/index.js";

let loopCount = 0;

export async function intentClassifier({
    messages,
    email,
    answered_intents = [],
    original_user_msg,
    cartOutput,
    session_id,
    used_tool,
    history = [],
}) {
    loopCount++;

    const toolList = [addToCartTool, matchProductTool];

    const usedTools = Array.isArray(used_tool) ? used_tool : (used_tool ? [used_tool] : []);

    const availableTools = toolList
        .filter(t => !usedTools.includes(t.name))
        .map(t => t.name)
        .join(", ");

    console.log("🚧 availableTools:", availableTools);

    const logKey = email || session_id;
    const log = (msg, step = null) => pushLog(logKey, { msg, step });

    const lastUserMsg =
        [...messages].reverse().find((m) => m.role === "user")?.content || "";
    const lastAiMsg =
        [...messages].reverse().find((m) => m.role === "ai")?.content || "";

    const userQuestion = original_user_msg || lastUserMsg;

    const similarConsult = await searchSimilar(userQuestion, 3, 0.5, "consult_docs");
    const similarSql = await searchSimilar(userQuestion, 3, 0.5, "sql_docs");
    const similarPolicy = await searchSimilar(userQuestion, 3, 0.5, "policy_docs");
    const similarTools = await searchSimilar(userQuestion, 3, 0.5, "tools");

    const formatSimilar = (similarDocs, label) =>
        similarDocs
            .map(doc => `→ (${label}) KH: ${doc.pageContent}\n   → AI: ${doc.metadata.answer}`)
            .join("\n");

    const consultContext = formatSimilar(similarConsult, "consult");
    const sqlContext = formatSimilar(similarSql, "sql");
    const policyContext = formatSimilar(similarPolicy, "policy");
    const toolContext = formatSimilar(similarTools, "tools");

    console.log(`\n🌀 intentClassifier Loop Back Count: ${loopCount}`);
    log(`Bill kiểm tra câu hỏi và kết quả.`, "intent-loop");
    console.log("🧠 User Question:", userQuestion);
    console.log("✅ answered_intents:", answered_intents);

    const products = await getProductCache();
    const productList = products.map((p) => `${p.name} (giá ${p.price}đ)`).join(", ");

    const historyFormatted = (history || [])
        .map((msg, i) => {
            if (msg.role === "user") {
                const next = history[i + 1];
                if (next?.role === "ai") {
                    return `KH: ${msg.content}\nAI: ${next.content}`;
                }
            }
            return null;
        })
        .filter(Boolean)
        .join("\n");

    const prompt = [
        [
            "system",
            `
Bạn là bộ phân loại intent cho trợ lý AI.
Dựa vào cuộc hội thoại gần đây giữa khách hàng và AI, hãy xác định intent tiếp theo của KH.

INTENT HỢP LỆ:
- consult: KH muốn tư vấn sản phẩm, size giày
- sql: KH hỏi về thông tin sản phẩm, giá, đơn hàng
- cancel: Chỉ khi KH muốn hủy đơn, thay đổi thông tin vận chuyển, thông tin cá nhân, ĐẶT HÀNG(check out).
- policy: KH hỏi về chính sách đổi trả, vận chuyển
- match_product: KH nhắc đến sản phẩm/hãng cụ thể (VD: “Yonex Astrox 100ZZ”, “giày Lining AYAS010”) → cần gọi tool match_product.
- add_to_cart: KH thể hiện rõ ý định mua, đặt hàng, thêm vào giỏ (VD: “mua ngay”, “thêm vào giỏ”, “đặt cây này”) → cần gọi tool add_to_cart.
- __end__: khi KH không hỏi thêm gì mới hoặc tất cả intent đã được trả lời
 
QUY TẮC:
1. Hãy đọc lịch sử tin nhắn KH và AI (historyFormatted).
2. Nếu câu hỏi hiện tại rất ngắn khó phân loại intent (ví dụ: "có", "ok", "tiếp tục") → hãy đoán intent dựa trên tin nhắn AI ngay trước đó.
3. Nếu KH hỏi nhiều ý (VD: "vợt cho người mới chơi và chính sách đổi trả") → chọn intent CHƯA có trong danh sách đã xử lý (answered_intents), theo thứ tự.
4. Nếu KH không hỏi gì thêm, hoặc tất cả intent đã có → trả về "__end__".
5. Đôi lúc có cần sử dụng tool nên hãy đọc lịch sử khoảng 10 cuộc trò chuyện (user - ai) gần nhất rồi đưa ra tool đúng nhất (availableTools).
6. Trả về đúng 1 từ: consult, sql, cancel, policy hoặc __end__. Không giải thích.
7. Nếu KH chỉ chào hỏi ("hi", "chào", "hello", "tôi tên là...", "cho mình hỏi", "mình mới tới",...) và không đề cập cụ thể, hãy mặc định phân loại là consult.
8. Nếu câu hỏi KH cần nhiều tool → chọn tool CHƯA có trong danh sách đã xử lý (used_tools), theo thứ tự.


Các tool hiện có: thêm vào giỏ hàng, chỉ consult có thể sử dụng tool này.
`
        ],
        [
            "human",
            `
⏳ Lịch sử hội thoại gần đây (historyFormatted):
${historyFormatted}

📌 Câu KH hiện tại: "${userQuestion}"
✅ Intent đã xử lý: ${answered_intents.join(", ") || "(chưa có)"}
🧠 Câu trả lời AI gần nhất: "${lastAiMsg}"

📦 Danh sách sản phẩm đang bán:
${productList}

Tool đã được dùng (usedTools): ${usedTools}
Tool có sẵn để dùng (availableTools): ${availableTools}

🧠 Các ví dụ tham khảo gần giống từ bộ huấn luyện:
${consultContext}
${sqlContext}
${policyContext}
${toolContext}
`
        ]
    ];

    const intent = await model.invoke(prompt);
    const raw = (intent.content || "").trim().toLowerCase();
    console.log("🟨 Classifier Raw Result:", raw);

    // --- Chuẩn hóa danh sách intent đã xử lý ---
    const prevAnswered = Array.isArray(answered_intents)
        ? answered_intents
        : answered_intents
            ? [answered_intents]
            : [];
    const uniqueAnswered = [...new Set(prevAnswered)];

    // --- Chuẩn hóa danh sách tool đã dùng ---
    const prevUsedTools = Array.isArray(used_tool)
        ? used_tool
        : used_tool
            ? [used_tool]
            : [];
    const uniqueUsedTools = [...new Set(prevUsedTools)];

    // --- Nếu intent trùng với intent đã xử lý → __end__
    if (uniqueAnswered.includes(raw)) {
        console.log(`⚠️ Intent ${raw} đã được xử lý, dừng lại.`);
        return {
            messages,
            next: "__end__",
            answered_intents: uniqueAnswered,
            original_user_msg: userQuestion,
            cartOutput,
        };
    }

    // --- Nếu intent là 1 tool và tool này đã dùng → __end__
    const toolNames = toolList.map(t => t.name);
    if (toolNames.includes(raw) && uniqueUsedTools.includes(raw)) {
        console.log(`⚠️ Tool ${raw} đã được sử dụng trước đó → dừng lại.`);
        return {
            messages,
            next: "__end__",
            answered_intents: uniqueAnswered,
            original_user_msg: userQuestion,
            cartOutput,
        };
    }

    // --- Nếu không, tiếp tục flow bình thường ---
    return {
        messages,
        next: raw,
        answered_intents: uniqueAnswered,
        original_user_msg: userQuestion,
        cartOutput,
    };

}
