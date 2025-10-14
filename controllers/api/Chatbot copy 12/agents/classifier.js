import productModel from "../../../../models/Product.js";
import aiChatbotModel from "../../../../models/Chatbot.js";
import { model } from "../../../../controllers/api/Chatbot/llm.js";
import { searchSimilar } from "../vectorStore.js";
import { pushLog } from "../extra/sseLogs.js";

let loopCount = 0;

export async function intentClassifier({
    messages,
    email,
    answered_intents = [],
    original_user_msg,
    cartOutput,
    session_id,
    history = [],
}) {
    loopCount++;

    const logKey = email || session_id;
    const log = (msg, step = null) => pushLog(logKey, { msg, step });

    const lastUserMsg =
        [...messages].reverse().find((m) => m.role === "user")?.content || "";
    const lastAiMsg =
        [...messages].reverse().find((m) => m.role === "ai")?.content || "";

    const userQuestion = original_user_msg || lastUserMsg;

    const similarConsult = await searchSimilar(userQuestion, 3, 0.75, "consult_docs");
    const similarSql = await searchSimilar(userQuestion, 3, 0.75, "sql_docs");
    const similarPolicy = await searchSimilar(userQuestion, 3, 0.75, "policy_docs");

    const formatSimilar = (similarDocs, label) =>
        similarDocs
            .map(doc => `→ (${label}) KH: ${doc.pageContent}\n   → AI: ${doc.metadata.answer}`)
            .join("\n");

    const consultContext = formatSimilar(similarConsult, "consult");
    const sqlContext = formatSimilar(similarSql, "sql");
    const policyContext = formatSimilar(similarPolicy, "policy");


    console.log(`\n🌀 intentClassifier Loop Back Count: ${loopCount}`);
    log(`Bill kiểm tra câu hỏi và kết quả.`, "intent-loop");
    console.log("🧠 User Question:", userQuestion);
    console.log("✅ answered_intents:", answered_intents);

    const products = await productModel.getAll();
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
- __end__: khi KH không hỏi thêm gì mới hoặc tất cả intent đã được trả lời
 
QUY TẮC:
1. Hãy đọc lịch sử tin nhắn KH và AI (historyFormatted).
2. Nếu câu hỏi hiện tại rất ngắn khó phân loại intent (ví dụ: "có", "ok", "tiếp tục") → hãy đoán intent dựa trên tin nhắn AI ngay trước đó.
3. Nếu KH hỏi nhiều ý (VD: "vợt cho người mới chơi và chính sách đổi trả") → chọn intent CHƯA có trong danh sách đã xử lý (answered_intents), theo thứ tự.
4. Nếu KH không hỏi gì thêm, hoặc tất cả intent đã có → trả về "__end__".
5. Đôi lúc có cần sử dụng tool nên hãy đọc lịch sử khoảng 10 cuộc trò chuyện (user - ai) gần nhất rồi đưa ra intent đung nhất.
eg. tôi muốn thêm yonex duora z strike vào giỏ hàng -> consult
6. Trả về đúng 1 từ: consult, sql, cancel, policy hoặc __end__. Không giải thích.
7. Nếu KH chỉ chào hỏi ("hi", "chào", "hello", "tôi tên là...", "cho mình hỏi", "mình mới tới",...) và không đề cập cụ thể, hãy mặc định phân loại là consult.

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

🧠 Các ví dụ tham khảo gần giống từ bộ huấn luyện:
${consultContext}
${sqlContext}
${policyContext}
`
        ]
    ];

    const intent = await model.invoke(prompt);
    const raw = (intent.content || "").trim().toLowerCase();
    console.log("🟨 Classifier Raw Result:", raw);

    // normalize answered_intents to unique list
    const prevAnswered = Array.isArray(answered_intents)
        ? answered_intents
        : answered_intents
            ? [answered_intents]
            : [];
    const uniqueAnswered = [...new Set(prevAnswered)];

    // if classifier suggests an intent already answered, end the conversation
    const next = uniqueAnswered.includes(raw) ? "__end__" : raw;

    return {
        messages,
        next,
        answered_intents: uniqueAnswered,
        original_user_msg: userQuestion,
        cartOutput,
    };
}
