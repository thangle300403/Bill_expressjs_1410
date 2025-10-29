// nodes/matchProductNode.js
import { pushLog } from "../extra/sseLogs.js";
import { saveChatHistory } from "../memory/saveChatHistory.js";
import fetch from "node-fetch";
import slugify from "slugify";

export async function matchProductNode(state) {
    console.log("🚧 Now calling external API for vector search...");
    const logKey = state.email || state.session_id;
    const log = (msg, step = null) => pushLog(logKey, { msg, step });

    const email = state.email || null;
    const session_id = state.session_id || null;
    const userQuestion = state.original_user_msg?.trim() || "";
    if (!userQuestion) return state;

    try {
        // 🧠 Call FastAPI (vector search only)
        const res = await fetch(
            `${process.env.FAST_API_SQLAGENT}/match/match_product?query=${encodeURIComponent(userQuestion)}`
        );
        const data = await res.json();

        console.log("🎯 Top matched product:", data.top_match);
        if (!data.success) {
            log("❌ No product found", "match-product");
            return state;
        }

        const top = data.top_match;
        const matchedList = data.matched_products || [];
        const cardHTML = data.card_html;

        log(`🎯 Ưu tiên chọn: ${top.name}`, "match-product");

        // 🧠 Save chat history
        const aiText = `✅ Đã lấy được thông tin sản phẩm.\n${cardHTML}`;
        await saveChatHistory({ email, session_id, role: "ai", content: aiText });

        const prevUsed = Array.isArray(state.used_tool)
            ? state.used_tool
            : state.used_tool
                ? [state.used_tool]
                : [];

        return {
            ...state,
            messages: [
                ...state.messages,
                { role: "ai", content: aiText, additional_kwargs: { tag: "match_product" } },
            ],
            matchedProdInUserQues: matchedList,
            topMatchedProduct: top,
            cartProduct: {
                product: top,
                quantity: 1,
            },
            productDetailUrls: cardHTML,
            current_step: "__end__",
            used_tool: [...new Set([...prevUsed, "match_product"])],
        };
    } catch (err) {
        console.error("❌ Vector API error:", err);
        log("🚨 Vector API failed", "match-product");
        return state;
    }
}
