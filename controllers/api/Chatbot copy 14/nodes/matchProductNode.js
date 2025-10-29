// nodes/matchProductNode.js
import { pushLog } from "../extra/sseLogs.js";
import { saveChatHistory } from "../memory/saveChatHistory.js";
import { getVectorStore } from "../vectorStore.js";
import slugify from "slugify";

export async function matchProductNode(state) {
    console.log("🚧 !!!!!!!! Now we enter: matchProductNode");
    const logKey = state.email || state.session_id;
    const log = (msg, step = null) => pushLog(logKey, { msg, step });

    const email = state.email || null;
    const session_id = state.session_id || null;
    const userQuestion = state.original_user_msg?.trim() || "";

    if (!userQuestion) return state;

    const normalizedQ = userQuestion.toLowerCase().replace(/\s+/g, " ");
    const vectorStore = await getVectorStore("product_descriptions");

    // 🔍 Semantic search
    const results = await vectorStore.similaritySearchWithScore(userQuestion, 8);
    if (!results.length) return state;

    // 🎯 Build candidate list
    const candidates = results.map(([doc, score]) => ({
        name: doc.metadata.name,
        price: doc.metadata.price,
        metadata: doc.metadata,
        score,
    }));

    // ⚡ Boost based on textual match
    const boosted = candidates.map((c) => {
        const normalizedName = c.name.toLowerCase().replace(/\s+/g, " ");
        const hasExact = normalizedQ.includes(normalizedName);
        const hasPartial = normalizedQ.includes(normalizedName.replace(/ pro\b/, ""));
        const bonus = hasExact ? 0.5 : hasPartial ? 0.2 : 0;
        return { ...c, totalScore: c.score + bonus };
    });

    // 🏆 Pick top match
    const topMatch = boosted.sort((a, b) => b.totalScore - a.totalScore)[0];
    const matchedProdInUserQues = boosted.map(
        (c) => `${c.name} (giá ${c.price.toLocaleString()}đ, điểm ${c.totalScore.toFixed(2)})`
    );

    console.log("🚧 topMatch:", topMatch);
    log(`🎯 Ưu tiên chọn: ${topMatch.name}`, "match-product");

    // ✅ Build product card HTML for the matched product
    let productDetailUrls = "";
    if (topMatch && topMatch.metadata) {
        const p = topMatch.metadata;
        const slug = slugify(p.name, { lower: true });
        const url = `${process.env.FRONTEND_URL_NEXT}/san-pham/${slug}-${p.product_id}`;
        const encodedMsg = encodeURIComponent(`tôi muốn thêm ${p.name} vào giỏ hàng`);
        const imgSrc = `${process.env.IMAGE_BASE_URL}/${p.featured_image}`;

        productDetailUrls = `
<div class="product-card" 
     style="border: 1px solid #ccc; border-radius: 8px; 
            padding: 8px; margin-bottom: 8px; 
            display: flex; align-items: center; gap: 10px; 
            background: #f8f9fa; max-width: 400px;">

  <img src="${imgSrc}" alt="${p.name}" 
       style="width: 70px; height: 70px; object-fit: contain; border-radius: 6px;" />

  <div style="flex: 1; line-height: 1.3;">
    <a href="${url}" 
       style="font-weight: bold; font-size: 14px; color: #1D4ED8; display: block; margin-bottom: 4px;" 
       target="_blank">${p.name}</a>
    <span style="font-size: 13px; color: #16A34A;">💰 ${p.price.toLocaleString()}đ</span>
  </div>

  <button class="add-to-cart-btn" 
          data-product="${p.name}" data-msg="${encodedMsg}" 
          style="background: #FACC15; color: #000; border: none; 
                 padding: 4px 8px; border-radius: 4px; 
                 font-size: 12px; font-weight: 500; cursor: pointer;">
    🛒 Thêm
  </button>
</div>`.trim();
    }

    // 🧠 Save AI message
    const aiText = `✅ Đã lấy được thông tin sản phẩm.${productDetailUrls ? "\n" + productDetailUrls : ""}`;
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
            {
                role: "ai",
                content: aiText,
                additional_kwargs: { tag: "match_product" },
            },
        ],
        matchedProdInUserQues,
        topMatchedProduct: topMatch.metadata,
        cartProduct: {                     // ✅ thêm đoạn này
            product: topMatch.metadata,
            quantity: 1,
        },
        productDetailUrls,
        current_step: "__end__",
        used_tool: [...new Set([...prevUsed, "match_product"])],
    };
}
