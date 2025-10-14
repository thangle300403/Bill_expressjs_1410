//CONSULTAGENT
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import productModel from "../../../../models/Product.js";
import slugify from "slugify";
import { searchSimilar } from "../vectorStore.js";
import { getVectorStore } from "../vectorStore.js";
import { model } from "../../../../controllers/api/Chatbot/llm.js";
import { pushLog } from "../extra/sseLogs.js";
import dotenv from "dotenv";
dotenv.config();

function looksLikeJSON(text) {
    return text.trim().startsWith("{") && text.trim().endsWith("}");
}

function normalize(text) {
    return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const consultPromptTemplate = ChatPromptTemplate.fromMessages([
    ["system", `
Bạn là trợ lý AI tư vấn về nhu cầu người chơi về cầu lông của shop, chỉ và chỉ về nhu cầu người chơi về cầu lông thôi xin vui lòng đừng trả lời về các policies hoặc giá cả
(policies và giá cả là thông tin bảo mật)
Các công việc khác sẽ được các trợ lí khác xử lí gồm các agent: consult, policy, cancel order.

Hãy nhớ giới thiệu bạn.
Am hiểu tất cả những kiến thức về cầu lông.
Trả lời ngắn gọn, thân thiện.
Chỉ tư vấn các sản phẩm liên quan đến câu hỏi khách.
Gợi ý đúng trình độ người chơi và giá hợp lý.
Nếu khách hỏi mơ hồ, hãy hỏi lại rõ nhu cầu.
- Sau khi tư vấn, HÃY GỢI Ý một câu hỏi tiếp theo để khách có muốn mua sản phẩm 
    (vd: Bạn có muốn thêm sản phẩm ... vào giỏ hàng hay tìm kiểu thêm sản phẩm)

Đôi lúc không cần sử dụng tool chỉ tư vấn, 

== Dữ liệu ==
Sản phẩm đang bán của shop chỉ tư vấn vợt trong đây: {productList}, vì đôi lúc khách hàng có thể điền sai chính tả sản phẩm.
Dựa vào lịch sử giao tiếp (ở database) để đưa câu trả lời đúng hơn: {historyFormatted}.
Mô tả sản phẩm gần giống nhất: {productContext}.
Tool đã dùng: {usedTools}.
Tool có sẵn: {availableTools}.
Sản phẩm có trong câu hỏi của khách hàng: {matchedProdInUserQues}.
Nếu 'matchedProdInUserQues' KHÔNG RỖNG, nghĩa là sản phẩm đó chắc chắn CÓ TRONG KHO, KHÔNG được trả lời rằng KHÔNG có hoặc HẾT HÀNG.

== Nhiệm vụ bổ sung ==
Dựa vào toàn bộ thông tin ở trên, hãy phân tích xem khách có cần:
- current_step = "add_to_cart" (Khách muốn thêm vào giỏ hàng và danh sách 'matchedProdInUserQues' có sản phẩm)
KHÔNG ĐƯỢC tự đoán. Nếu có nghi ngờ, hãy gọi tool.- current_step = "intent" (Khi không có sử dụng thêm tool nào)
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

export async function consultAgent({ messages, email, history, session_id, intent, answered_intents = [], original_user_msg, used_tool, cartProduct }) {
    try {
        const logKey = email || session_id;
        const log = (msg, step = null) => pushLog(logKey, { msg, step });

        console.log("🚧 !!!!!!!! Now we enter:", intent);
        log(`Trợ lí đang tư vấn`, "intent-consult");

        const products = await productModel.getAll();

        const productList = products
            .map(p => `${p.name} (giá ${p.price}đ)`)
            .join(", ");

        const toolList = ["add_to_cart"];
        const usedTools = Array.isArray(used_tool) ? used_tool : (used_tool ? [used_tool] : []);

        console.log("🚧 usedTools:", usedTools);

        const availableTools = toolList.filter(t => !usedTools.includes(t)).join(", ");

        const userQuestion = messages.at(-1)?.content || "";

        const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, "");

        log(`Trợ lí đang kiểm tra sản phẩm có trong câu hỏi khách hàng`, "consult-matchedProdInUserQues");

        const normalizedQ = normalize(userQuestion);
        const filtered = products.filter(p => normalizedQ.includes(normalize(p.name)));

        const topMatchedProduct = filtered[0];

        // matchedProdInUserQues để đưa vào prompt
        const matchedProdInUserQues = filtered.map(
            (p) => `${p.name} (giá ${p.price}đ)`
        );

        console.log("🚧 matchedProdInUserQues:", matchedProdInUserQues);

        log(`Trợ lí đang nhớ lại lịch sử giao tiếp`, "consult-his");
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

        // const similar = await searchSimilar(userQuestion, 5, 0.7, "consult_docs");
        // const context = similar.map(doc =>
        //     `KH: ${doc.pageContent}\nAI: ${doc.metadata.answer}`
        // ).join("\n");

        log(`Trợ lí xem chi tiết phần mô tả của các sản phẩm`, "consult-his");

        const productVectorStore = await getVectorStore("product_descriptions");
        const similarProducts = await productVectorStore.similaritySearch(userQuestion, 3);
        const productContext = similarProducts
            .map((doc, idx) => `#${idx + 1} ${doc.pageContent}`)
            .join("\n");
        log(`Trợ lí đang hoàn thành phần tư vấn`, "consult-invoke");

        const response = await consultChain.invoke({
            messages,
            productList,
            historyFormatted,
            usedTools,
            availableTools,
            productContext,
            matchedProdInUserQues,
        });

        log(`Trợ lí hoàn thành phần tư vấn`, "consult-invoke-done");

        const raw = response.content.trim();
        // if model requests a tool already used, override to intent
        // if (usedTools.includes(parsed.current_step)) {
        //     parsed.current_step = "intent";
        // }

        console.log("🚧 raw:", raw);

        //check tool xài chưa
        let parsed, aiText;

        log(`Trợ lí phân tích phần tư vấn`, "consult-parse");
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

        //lấy card product
        log(`Trợ lí phân tích phần tư vấn oooo`, "consult-parse-done");
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
        const newUsedTools = [...new Set([...prevUsed, parsed.current_step])];
        console.log("AI consult done");
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