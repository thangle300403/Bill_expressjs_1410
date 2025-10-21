// nodes/matchProductNode.js
import { pushLog } from "../extra/sseLogs.js";
import { saveChatHistory } from "../memory/saveChatHistory.js";
import { getVectorStore } from "../vectorStore.js";

export async function matchProductNode(state) {
    console.log("🚧 !!!!!!!! Now we enter: matchProductNode");
    const logKey = state.email || state.session_id;

    const email = state.email || null;
    const session_id = state.session_id || null;
    
    const log = (msg, step = null) => pushLog(logKey, { msg, step });

    const userQuestion = state.original_user_msg?.trim() || "";
    if (!userQuestion) return state;

    const normalizedQ = userQuestion.toLowerCase().replace(/\s+/g, " ");
    const vectorStore = await getVectorStore("product_descriptions");

    // Semantic search first
    const results = await vectorStore.similaritySearchWithScore(userQuestion, 8);
    if (!results.length) return state;

    // Build candidate list
    const candidates = results.map(([doc, score]) => ({
        name: doc.metadata.name,
        price: doc.metadata.price,
        metadata: doc.metadata,
        score
    }));

    // Apply bonus if user text explicitly includes product name
    const boosted = candidates.map(c => {
        const normalizedName = c.name.toLowerCase().replace(/\s+/g, " ");
        const hasExact = normalizedQ.includes(normalizedName);
        const hasPartial = normalizedQ.includes(normalizedName.replace(/ pro\b/, "")); // handles "88d pro" vs "88d"
        const bonus = hasExact ? 0.5 : hasPartial ? 0.2 : 0;
        return { ...c, totalScore: c.score + bonus };
    });

    // Pick best after boosting
    const topMatch = boosted.sort((a, b) => b.totalScore - a.totalScore)[0];
    const matchedProdInUserQues = boosted.map(
        c => `${c.name} (giá ${c.price.toLocaleString()}đ, điểm ${(c.totalScore).toFixed(2)})`
    );

    console.log("🚧 topMatch:", topMatch);

    log(`🎯 Ưu tiên chọn: ${topMatch.name}`, "match-product");
    console.log("🚧 matchedProdInUserQues:", matchedProdInUserQues);

    const prevUsed = Array.isArray(state.used_tool)
        ? state.used_tool
        : state.used_tool ? [state.used_tool] : [];

    const aiText = `✅ Đã lấy được thông tin sản phẩm.`;

    // 🧠 Save AI message to chat history
    await saveChatHistory({
        email,
        session_id,
        role: "ai",
        content: aiText,
    });

    return {
        ...state,
        messages: [
            ...state.messages,
            {
                role: "ai",
                content: aiText,
                additional_kwargs: { tag: "add_to_cart_confirmation" },
            },
        ],
        matchedProdInUserQues,
        topMatchedProduct: topMatch.metadata,
        current_step: "consult",
        used_tool: [...new Set([...prevUsed, "match_product"])],
    };
}
