import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import productModel from "../../../../models/Product.js";
import aiChatbotModel from "../../../../models/Chatbot.js";
import pool from "../../../../models/db.js";
import { extractSQL } from "../extra/parser.js";
import { loadSchema } from "../extra/schemaLoader.js";
import slugify from "slugify";
import { searchSimilar } from "../vectorStore.js";
import { encrypt } from "../extra/encrypt.js";
import { getVectorStore } from "../vectorStore.js";
import { model } from "../../../../controllers/api/Chatbot/llm.js";
import { pushLog } from "../extra/sseLogs.js";

function normalize(text) {
    return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export const sql_generator = async ({ messages, email, session_id, history, intent }) => {
    console.log("🚧 Executing: sql_generator");
    const logKey = email || session_id;

    const log = (msg, step = null) => pushLog(logKey, { msg, step });

    log(`Trợ lí đang truy cập cơ sở dữ liệu.`, "sql-generator");

    try {
        const products = await productModel.getAll();

        const productList = products
            .map(p => `${p.name} (giá ${p.price}đ)`)
            .join(", ");

        // const formattedHistory = (history || [])
        //     .map(m => `${m.role === "user" ? "KH" : "AI"}: ${m.content}`)
        //     .join("\n");

        const sqlPromptTemplate = ChatPromptTemplate.fromMessages([
            ["system", `
Bạn là AI sinh câu lệnh SQL từ câu hỏi khách hàng và các chính sách của shop.

Yêu cầu:
- Chỉ sinh câu lệnh SELECT đúng cú pháp theo schema bên dưới.
- KHÔNG được sinh UPDATE, DELETE, INSERT, DROP.
- Nếu truy vấn từ bảng product thì PHẢI LUÔN bao gồm cột \`id\`, \`discount_percentage\` và \`name\` trong SELECT (để tạo liên kết sản phẩm).
- Ví dụ: hỏi giá thì cần SELECT id, name, price, discount_percentage.
- KHÔNG giải thích. Trả về SQL duy nhất bên trong block: \`\`\`sql ... \`\`\`

Khi hỏi về đơn hàng thì phải lấy thêm luôn email ví dụ: thông tin đơn hàng này của email ... là :...

--Dữ liệu--
Schema: {schema}
danh sách sản phẩm - đây là sản phẩm của shop đang bán(**Dựa vào đây để sửa chính tả khách hàng**): ${productList}
Lịch sử tương tác khách hàng (trong db): {historyFormatted} 
`],
            ["human", `Email: {email}`],
            new MessagesPlaceholder("messages")
        ]);

        const userQuestion = messages.at(-1)?.content || "";

        console.log("✅ intent in sql gen:", intent);

        const schema = await loadSchema();

        const encryptedMessage = encrypt(intent);
        const rawHistory = await aiChatbotModel.findByMessageAndEmail(encryptedMessage, email);

        const historyFormatted = rawHistory.map(row => {
            return `KH: ${row.question}\nAI: ${row.ai_answer}`;
        }).join("\n");

        const sqlChain = RunnableSequence.from([sqlPromptTemplate, model]);

        const response = await sqlChain.invoke({ messages, schema, email, historyFormatted });

        const sql = extractSQL(response.content);
        console.log("✅ SQL:", sql);
        return { sql, current_step: "sql_executor" };
    } catch (error) {
        console.error("❌ sql_generator failed:", error.message);
        return {
            current_step: "__end__",
            error: "sql_generator failed: " + error.message,
        };
    };
}

export const sql_executor = async (state) => {
    console.log("🚧 Executing: sql_executor");

    const lowerSQL = state.sql?.toLowerCase() || "";
    if (!lowerSQL.startsWith("select") || /update|delete|insert|drop/.test(lowerSQL)) {
        const warnMsg = {
            role: "ai",
            content: "⚠️ Bill chỉ hỗ trợ truy vấn SELECT.",
        };
        return {
            messages: [...(state.messages || []), warnMsg],
            current_step: "__end__",
            error: "Non-SELECT SQL detected",
        };
    }

    const usesEmail = /\b[a-z_]*\.?email\b/.test(lowerSQL);

    if (usesEmail && !state.email) {
        const loginMsg = {
            role: "ai",
            content: "⚠️ Bạn cần đăng nhập để truy xuất thông tin cá nhân của mình. Vui lòng đăng nhập trước khi tiếp tục.",
        };

        return {
            messages: [...(state.messages || []), loginMsg],
            current_step: "__end__",
            answered_intents: [...(state.answered_intents || []), "sql"],
        };
    }


    try {
        const [rows] = await pool.execute(state.sql);
        if (!rows.length) {
            console.warn("⚠️ Empty result");
            return {
                dbRows: rows,
                current_step: "__end__",
                error: "No rows returned",
            };
        }

        return { dbRows: rows, current_step: "result_refiner" };
    } catch (err) {
        console.error("❌ SQL execution error:", err.message);
        return {
            messages: [{ content: `❌ Lỗi SQL: ${err.message}` }],
            current_step: "__end__",
            error: "SQL execution failed",
        };
    }
};

export const result_refiner = async ({ messages, dbRows, session_id, history, intent, email }) => {
    console.log("🚧 Executing: result_refiner");
    const logKey = email || session_id;
    const log = (msg, step = null) => pushLog(logKey, { msg, step });
    log(`Trợ lí đưa ra câu trả lời.`, "sql-final-refiner");
    try {
        const allProducts = await productModel.getAll();
        await getVectorStore("sql_docs");
        const schema = await loadSchema();

        if (!dbRows || dbRows.length === 0) {
            return {
                refined: "⚠️ Không có dữ liệu phù hợp.",
                resultMessage: "",
                messages: [{ content: "⚠️ Không có dữ liệu phù hợp." }],
                current_step: "__end__"
            };
        }

        const headers = Object.keys(dbRows[0]).join(" | ");
        const rows = dbRows.map(r => Object.values(r).join(" | ")).join("\n");
        let raw = `✅ Kết quả:\n${headers}\n${rows}`;

        const urls = dbRows.filter(r => r.id && r.name).map(r => {
            const slug = slugify(r.name, { lower: true });
            return `[${r.name}](${process.env.FRONTEND_URL_NEXT}/san-pham/${slug}-${r.id})`;
        });

        if (urls.length > 0) raw += `\n${urls.join("\n")}`;

        const refinePrompt = ChatPromptTemplate.fromMessages([
            ["system", `
Bạn là trợ lý AI cầu lông. Dưới đây là câu hỏi của khách hàng: {userQuestion} và dữ liệu thô từ kết quả SQL. Hãy diễn giải lại thông tin một cách lịch sự, dễ hiểu và NGẮN GỌN cho khách hàng.

LUẬT:
- Nếu dữ liệu là rỗng thì trả lời không có kết quả.
- Nếu trong dữ liệu có liên kết Markdown (dạng [Tên](url)) thì PHẢI GIỮ NGUYÊN.
- KHÔNG được tự ý bỏ liên kết, thay đổi URL, hoặc cắt bỏ phần \"📦 Xem chi tiết\".

Schema:
{schema}

Lịch sử giao tiếp (ở database):
{formattedHistory}

Dựa vào lịch sử của khách trên đây để học về khách hàng, rút kinh nghiệm sai lầm của mình và sau khi trả lời, nếu phù hợp, hãy hỏi khách một câu tiếp theo.

`],
            ["human", `{raw}`]
        ]);
        const userQuestion = messages.at(-1)?.content || "";

        const formattedHistory = (history || [])
            .map(m => `${m.role === "user" ? "KH" : "AI"}: ${m.content}`)
            .join("\n");

        const similar = await searchSimilar(userQuestion, 5, 0.5, "sql_docs");
        const context = similar.map(doc =>
            `KH: ${doc.pageContent}\nAI: ${doc.metadata.answer}`
        ).join("\n");

        const refineChain = RunnableSequence.from([refinePrompt, model]);
        const refined = await refineChain.invoke({ raw, schema, formattedHistory, userQuestion });

        const matched = [];
        const seen = new Set();
        const aiText = refined.content.toLowerCase();

        for (const p of allProducts) {
            if (
                aiText.includes(p.name.toLowerCase()) &&
                !seen.has(p.name)
            ) {
                matched.push(p);
                seen.add(p.name);
            }
        }

        let productDetailCards = "";
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

            productDetailCards = `\n${urls.join("\n")}`;
        }

        console.log("✅ AI response");

        return {
            refined: refined.content + productDetailCards,
            resultMessage: raw,
            current_step: "responder"
        };
    } catch (error) {
        console.error("❌ result_refiner failed:", error.message);
        return {
            current_step: "__end__",
            error: "result_refiner failed: " + error.message,
        };
    }
};

export const responder = async ({ refined, messages, email, sql, dbRows, answered_intents = [], original_user_msg }) => {
    console.log("🚧 Executing: responder");

    try {
        const safeAnswer = refined || "❓ Không có nội dung phản hồi.";

        return {
            messages: [...messages, { role: "ai", content: safeAnswer }],
            answered_intents: [...(answered_intents || []), "sql"],
            current_step: "__end__"
        };
    } catch (error) {
        console.error("❌ responder failed:", error.message);
        return {
            current_step: "__end__",
            error: "responder failed: " + error.message,
        };
    }
};

