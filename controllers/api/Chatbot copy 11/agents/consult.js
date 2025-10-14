//CONSULTAGENT
import { ChatMessagePromptTemplate, ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import productModel from "../../../../models/Product.js";
import slugify from "slugify";
import { searchSimilar } from "../vectorStore.js";
import { getVectorStore } from "../vectorStore.js";
import { model } from "../../../../controllers/api/Chatbot/llm.js";
import { pushLog } from "../extra/sseLogs.js";
import dotenv from "dotenv";
import { getProductCache, isProductCacheLoaded } from "../cache/productCache.js";
dotenv.config();

function looksLikeJSON(text) {
    return text.trim().startsWith("{") && text.trim().endsWith("}");
}

function normalize(text) {
    return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const consultPromptTemplate = ChatPromptTemplate.fromMessages([
    ["system", `
You are an AI assistant specializing in badminton equipment consultation for a shop. 
You ONLY advise about badminton gear (rackets, shoes, apparel, etc.). 
Do not answer about policies or prices – those are handled by other agents.

Always introduce yourself briefly.
Be friendly and concise.
Recommend products that match the customer’s level and budget.
If the customer’s request is vague, ask clarifying questions.
After giving advice, ALWAYS suggest a follow-up question like 
"Bạn có muốn thêm sản phẩm này vào giỏ hàng không?" (in Vietnamese).

NOTE:
Some times more than one tool will be used, but match_product must always use first. exmaple: Tôi muốn mua Yonex Astrox 100ZZ, call tool "current_step": "match_product" first to detect product then call "current_step": "add_to_cart".
You know when there are products in the user message, you must call "current_step": "match_product" first to detect product then call "current_step": "add_to_cart".
Sometimes queston like: Vợt cho người đập mạnh, mới chơi no product provided then u just need to consult no tools needed to use give answer then go to intent.
- Each tool can only be used ONCE, If a tool is already in usedTools, do not call it again.  
- current_step = "intent" (When no more toolss are needed)
- All final responses visible to the customer must be in Vietnamese.
Always look at the Semantic context to consult to customer, just consult when no brand and price are given.

== Output Requirements ==
- For consult-only: reply in plain Vietnamese text.  
- For tool calls: reply in JSON exactly as shown, with "response" in Vietnamese.

== Data Provided ==
- Product list: {productList}
- Conversation history: {historyFormatted}
- Product descriptions  (Semantic context): {productContext} 
- Tools already used usedTools: {usedTools}
- Tools available: {availableTools}  
- Products detected in user’s message: {matchedProdInUserQues}
⚠️ If 'matchedProdInUserQues' is NOT EMPTY, it means those products DEFINITELY exist in stock. 
Do NOT say they are unavailable or out of stock.

== Rules ==
trả lời bằng ĐÚNG CÚ PHÁP JSON như sau:
{{  
  "response": "<câu trả lời>",  
  "current_step": "add_to_cart" || "match_product || etc."
    }}
  `],

    new MessagesPlaceholder("messages"),
]);



const consultChain = RunnableSequence.from([consultPromptTemplate, model]);

export async function consultAgent({ messages, email, history, session_id, intent, answered_intents = [], original_user_msg, used_tool, cartProduct, matchedProdInUserQues = [], topMatchedProduct }) {
    try {
        const logKey = email || session_id;
        const log = (msg, step = null) => pushLog(logKey, { msg, step });

        console.log("✅ consultAgent received topMatchedProduct:", topMatchedProduct?.name);

        console.log("🚧 !!!!!!!! Now we enter:", intent);
        log(`Trợ lí đang tư vấn`, "intent-consult");

        const products = await getProductCache();

        const productList = products
            .map(p => `${p.name} (giá ${p.price}đ)`)
            .join(", ");

        const toolList = ["add_to_cart", "match_product"];

        const usedTools = Array.isArray(used_tool) ? used_tool : (used_tool ? [used_tool] : []);

        console.log("🚧 usedTools:", usedTools);

        const availableTools = toolList.filter(t => !usedTools.includes(t)).join(", ");

        const userQuestion = messages.at(-1)?.content || "";

        log(`Đang lưu lại lịch sử giao tiếp`, "consult-his");
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

        log(`Đang ltìm kiếm các sản phẩm phù hợp`, "consult-his");
        const productVectorStore = await getVectorStore("product_descriptions");
        const similarProducts = await productVectorStore.similaritySearch(userQuestion, 3);
        const productContext = similarProducts
            .map((doc, idx) => `#${idx + 1} ${doc.pageContent}`)
            .join("\n");

        log(`Bill tổng hợp dữ liệu gửi cho trợ lí tư vấn `, "consult-invoke");

        const response = await consultChain.invoke({
            messages,
            productList,
            historyFormatted,
            usedTools,
            availableTools,
            productContext,
            matchedProdInUserQues,
        });

        let raw = response.content.trim();

        console.log("🚧 raw:", raw);

        // 🔧 Fix LLM output that is wrapped in markdown ```json
        if (raw.startsWith("```json")) {
            raw = raw.replace(/^```json\s*/, "").replace(/```$/, "").trim();
        } else if (raw.startsWith("```")) {
            raw = raw.replace(/^```\s*/, "").replace(/```$/, "").trim();
        }

        log(`Kiểm tra tool sẽ dùng`, "consult-check");
        //check tool xài chưa
        let parsed, aiText;

        try {
            if (!looksLikeJSON(raw)) throw new Error("Quick reject: Not JSON");

            parsed = JSON.parse(raw);

            if (parsed.current_step === "add_to_cart") {
                aiText = ""; // hoặc bạn có thể cho `null` nếu cần
            } else {
                aiText = parsed.response;
            }

            if (usedTools.includes(parsed.current_step)) {
                console.warn(`⚠️ Tool "${parsed.current_step}" was already used. Downgrading to "intent".`);
                parsed.current_step = "intent";
            }
        } catch (e) {
            console.warn("⚠️ Not valid JSON. Treating as plain text response.");
            parsed = { current_step: "intent" };
            aiText = raw;
        }

        log(`Trợ lí đang chuẩn bị sản phẩm`, "consult-matched");

        //lấy card product
        const matched = [];
        const seenNames = new Set();

        for (const p of products) {
            if (
                aiText.toLowerCase().includes(p.name.toLowerCase()) &&
                !seenNames.has(p.name)
            ) {
                matched.push(p);
                seenNames.add(p.name);
            }
        }
        let productDetailUrls = "";
        console.log("🚀 IMAGE_BASE_URL =", process.env.IMAGE_BASE_URL);

        if (matched.length > 0) {
            const urls = matched.map((p) => {
                const slug = slugify(p.name, { lower: true });
                const url = `${process.env.FRONTEND_URL_NEXT}/san-pham/${slug}-${p.id}`;
                const encodedMsg = encodeURIComponent(`tôi muốn thêm ${p.name} vào giỏ hàng`);
                const imgSrc = `${process.env.IMAGE_BASE_URL}/${p.featured_image}`;

                return `
<div class="product-card" 
     style="border: 1px solid #ccc; border-radius: 8px; 
            padding: 8px; margin-bottom: 8px; 
            display: flex; align-items: center; gap: 10px; 
            background: #f8f9fa; max-width: 400px;">

  <!-- Image -->
  <img src="${imgSrc}" alt="${p.name}" 
       style="width: 70px; height: 70px; object-fit: contain; border-radius: 6px;" />

  <!-- Info -->
  <div style="flex: 1; line-height: 1.3;">
    <a href="${url}" 
       style="font-weight: bold; font-size: 14px; color: #1D4ED8; display: block; margin-bottom: 4px;" 
       target="_blank">${p.name}</a>
    <span style="font-size: 13px; color: #16A34A;">💰 ${p.price.toLocaleString()}đ</span>
  </div>

  <!-- Small Button -->
  <button class="add-to-cart-btn" 
          data-product="${p.name}" data-msg="${encodedMsg}" 
          style="background: #FACC15; color: #000; border: none; 
                 padding: 4px 8px; border-radius: 4px; 
                 font-size: 12px; font-weight: 500; cursor: pointer;">
    🛒 Thêm
  </button>
</div>
  `.trim();
            });

            productDetailUrls = `\n${urls.join("\n")}`;
        }

        console.log("Consult agent curent_step:", parsed.current_step);
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

        let newUsedTools = [...prevUsed];
        if (parsed.current_step && parsed.current_step !== "intent") {
            if (parsed.current_step === "add_to_cart") {
                if (topMatchedProduct) {
                    newUsedTools = [...new Set([...prevUsed, "add_to_cart"])];
                }
            } else {
                newUsedTools = [...new Set([...prevUsed, parsed.current_step])];
            }
        }

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
            cartProduct: ["add_to_cart"].includes(parsed.current_step) && topMatchedProduct
                ? { product: topMatchedProduct, quantity: 1 }
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