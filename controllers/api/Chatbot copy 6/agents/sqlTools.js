import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import productModel from "../../../../models/Product.js";
import aiChatbotModel from "../../../../models/Chatbot.js";
import pool from "../../../../models/db.js";
import { extractSQL } from "../extra/parser.js";
import { loadSchema } from "../extra/schemaLoader.js";
import slugify from "slugify";
import { saveChatHistory } from "../memory/saveChatHistory.js";
import { searchSimilar } from "../vectorStore.js";
import { encrypt } from "../extra/encrypt.js";
import { getVectorStore } from "../vectorStore.js";
import { model } from "../../../../controllers/api/Chatbot/llm.js";


export const sql_generator = async ({ messages, email, history, intent }) => {
    console.log("🚧 Executing: sql_generator");

    try {
        const products = await productModel.getAll();

        const productList = products
            .map(p => `${p.name} (giá ${p.price}đ)`)
            .join(", ");

        const schema = await loadSchema();
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

Schema:
{schema}

danh sách sản phẩm (**Dựa vào đây để sửa chính tả khách hàng**):
${productList}

Lịch sử tương tác khách hàng (trong db):
{historyFormatted} 

Hãy sử dụng thông tin lịch sử này để học về khách hàng, rút kinh nghiệm sai lầm của mình và trả lời câu hỏi mới một cách chính xác và hỏi lại khách hàng.

`],
            ["human", `Email: {email}`],
            new MessagesPlaceholder("messages")
        ]);

        const userQuestion = messages.at(-1)?.content || "";

        console.log("✅ intent in sql gen:", intent);

        const encryptedMessage = encrypt(intent);
        const rawHistory = await aiChatbotModel.findByMessageAndEmail(encryptedMessage, email);

        const historyFormatted = rawHistory.map(row => {
            return `KH: ${row.question}\nAI: ${row.ai_answer}`;
        }).join("\n");

        // const similar = await searchSimilar(userQuestion, 5, intent, 0.05);
        // const context = similar.map(doc =>
        //     `KH: ${doc.pageContent}\nAI: ${doc.metadata.answer}`
        // ).join("\n");

        const sqlChain = RunnableSequence.from([sqlPromptTemplate, model]);

        // const response = await sqlChain.invoke({ messages, schema, email, context, historyFormatted });

        const response = await sqlChain.invoke({ messages, schema, email, historyFormatted });

        const sql = extractSQL(response.content);
        console.log("✅ SQL:", sql);
        return { sql, current_step: "sql_executor" };
    } catch (error) {
        console.error("❌ sql_generator failed:", error.message);
        return {
            current_step: "sql_planner",
            error: "sql_generator failed: " + error.message,
        };
    };
}

export const sql_executor = async (state) => {
    console.log("🚧 Executing: sql_executor");

    const lowerSQL = state.sql?.toLowerCase() || "";
    if (!lowerSQL.startsWith("select") || /update|delete|insert|drop/.test(lowerSQL)) {
        console.warn("⚠️ Only SELECT is supported");
        return {
            messages: [{ content: "⚠️ Bill chỉ hỗ trợ truy vấn SELECT." }],
            current_step: "sql_planner",
            error: "Non-SELECT SQL detected",
        };
    }

    try {
        const [rows] = await pool.execute(state.sql);
        if (!rows.length) {
            console.warn("⚠️ Empty result");
            return {
                dbRows: rows,
                current_step: "sql_planner",
                error: "No rows returned",
            };
        }

        return { dbRows: rows, current_step: "result_refiner" };
    } catch (err) {
        console.error("❌ SQL execution error:", err.message);
        return {
            messages: [{ content: `❌ Lỗi SQL: ${err.message}` }],
            current_step: "sql_planner",
            error: "SQL execution failed",
        };
    }
};

export const result_refiner = async ({ messages, dbRows, history, intent, email }) => {
    console.log("🚧 Executing: result_refiner");
    try {
        await getVectorStore("sql_docs");
        const schema = await loadSchema();
        const formattedHistory = (history || [])
            .map(m => `${m.role === "user" ? "KH" : "AI"}: ${m.content}`)
            .join("\n");
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

        if (urls.length > 0) raw += `\n📦 Xem chi tiết:\n${urls.join("\n")}`;

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
{historyFormatted}

Lịch sử có embedding vector gần giống nhất: {context}

Dựa vào lịch sử của khách trên đây để học về khách hàng, rút kinh nghiệm sai lầm của mình và sau khi trả lời, nếu phù hợp, hãy hỏi khách một câu tiếp theo.

`],
            ["human", `{raw}`]
        ]);
        const userQuestion = messages.at(-1)?.content || "";

        const encryptedMessage = encrypt(intent);
        const rawHistory = await aiChatbotModel.findByMessageAndEmail(encryptedMessage, email);

        // for (const row of rawHistory) {
        //     await addToVectorStore({
        //         question: row.question,
        //         answer: row.ai_answer,
        //         email,
        //         type: intent,
        //     }, "sql_docs");
        // }

        // console.log("✅ Rebuilt Chroma memory from DB");

        const historyFormatted = rawHistory.map(row => {
            return `KH: ${row.question}\nAI: ${row.ai_answer}`;
        }).join("\n");

        const similar = await searchSimilar(userQuestion, 5, 0.5, "sql_docs");
        const context = similar.map(doc =>
            `KH: ${doc.pageContent}\nAI: ${doc.metadata.answer}`
        ).join("\n");

        const refineChain = RunnableSequence.from([refinePrompt, model]);
        const refined = await refineChain.invoke({ raw, schema, historyFormatted, userQuestion, context });
        // const refined = await refineChain.invoke({ raw, schema, historyFormatted, userQuestion });


        console.log("✅ AI response");

        return {
            refined: refined.content,
            resultMessage: raw,
            current_step: "responder"
        };
    } catch (error) {
        console.error("❌ result_refiner failed:", error.message);
        return {
            current_step: "sql_planner",
            error: "result_refiner failed: " + error.message,
        };
    }
};

export const responder = async ({ refined, messages, email, sql, dbRows, answered_intents = [], original_user_msg }) => {
    console.log("🚧 Executing: responder");

    try {
        const safeAnswer = refined || "❓ Không có nội dung phản hồi.";
        await saveChatHistory({
            email,
            question: original_user_msg || "",
            aiAnswer: safeAnswer,
            type: "sql",
            sql,
            dbRows
        });

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

