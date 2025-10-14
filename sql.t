//SQLAGENT

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import productModel from "../../../../models/Product.js"; // ✅ your model
import { StateGraph } from "@langchain/langgraph";
import pool from "../../../../models/db.js";
import { extractSQL } from "../parser.js";
import { loadSchema } from "../schemaLoader.js";
import { z } from "zod";
import slugify from "slugify";
import { saveChatHistory } from "../saveChatHistory.js";

const model = new ChatGoogleGenerativeAI({
    model: "gemini-1.5-pro",
    apiKey: process.env.GEMINI_API_KEY,
    temperature: 0.3,
});

const sqlPromptTemplate = ChatPromptTemplate.fromMessages([
    ["system", `
Bạn là AI sinh câu lệnh SQL từ câu hỏi khách hàng và các chính sách của shop.
Chỉ sinh SQL SELECT đúng cú pháp theo schema bên dưới.
Không cần giải thích.
Trả lại SQL duy nhất bên trong block: \`\`\`sql ... \`\`\`

Lưu ý: 
- Khi khách hỏi về thông tin cá nhân của họ thì không được tiết lộ.
- Chỉ sinh SQL SELECT đúng cú pháp theo schema bên dưới.
- KHÔNG được sinh bất kỳ câu lệnh UPDATE, DELETE, INSERT, DROP.
- Nếu truy vấn từ bảng product thì PHẢI luôn có cột \`name\` và \`id\` trong SELECT (để tạo URL sản phẩm).
vd: Hỏi giá thì phải thêm cột price và cột name trong SELECT.
- KHÔNG giải thích. Trả về SQL duy nhất bên trong block: \`\`\`sql ... \`\`\`

Schema:
{schema}
`],
    ["human", `Email người dùng hiện tại là: {email}`],
    new MessagesPlaceholder("messages")
]);

const sqlChain = RunnableSequence.from([sqlPromptTemplate, model]);

const refinePrompt = ChatPromptTemplate.fromMessages([
    ["system", `
Bạn là trợ lý AI cầu lông. Dưới đây là dữ liệu thô từ kết quả SQL (dạng danh sách hoặc bảng). Hãy diễn giải lại nội dung một cách lịch sự, ngắn gọn và dễ hiểu với khách hàng dựa vào thông tin schema dưới đây.

Nếu danh sách là đơn hàng: dùng từ "Đơn hàng", "đã bị hủy", v.v.
Nếu là sản phẩm: gợi ý nhẹ nhàng, không liệt kê cứng nhắc.
Nếu tìm có link sản phẩm thì ghi là Xem chi tiết.

Schema:
{schema}
`],
    ["human", `{raw}`]
]);

const refineSQLResponseChain = RunnableSequence.from([refinePrompt, model]);


const PlanningState = z.object({
    messages: z.array(z.any()),
    next_step: z.string().optional(),
    schema: z.string(),
    sql: z.string().optional(),
    dbRows: z.array(z.any()).optional(),
    resultMessage: z.string().optional(),
    refined: z.string().optional(),
    email: z.string()
});

const sql_generator = async ({ messages, email }) => {
    const schema = await loadSchema();
    const response = await sqlChain.invoke({ messages, schema, email });
    const sql = extractSQL(response.content);
    console.log("✅ SQL:", sql);
    return { sql, next_step: "sql_executor" };
};

const sql_executor = async ({ sql }) => {
    const lowerSQL = sql?.toLowerCase() || "";
    if (!lowerSQL.startsWith("select") || /update|delete|insert|drop/.test(lowerSQL)) {
        return {
            messages: [{ content: "⚠️ Bill chỉ hỗ trợ truy vấn SELECT." }],
            next_step: "__end__"
        };
    }
    let dbRows = [];
    try {
        if (sql) [dbRows] = await pool.execute(sql);
    } catch (err) {
        return {
            messages: [{ content: `❌ Lỗi SQL: ${err.message}` }],
            next_step: "__end__"
        };
    }
    console.log("✅ DB Rows:", dbRows);
    return { dbRows, next_step: "result_refiner" };
};

const result_refiner = async ({ dbRows }) => {
    const schema = await loadSchema();
    if (!dbRows || dbRows.length === 0) {
        return { refined: "⚠️ Không có dữ liệu phù hợp.", next_step: "__end__" };
    }
    const headers = Object.keys(dbRows[0]).join(" | ");
    const rows = dbRows.map(r => Object.values(r).join(" | ")).join("\n");
    let raw = `✅ Kết quả:\n${headers}\n${rows}`;

    const urls = dbRows.filter(r => r.id && r.name).map(r => {
        const slug = slugify(r.name, { lower: true });
        return `[${r.name}](${process.env.FRONTEND_URL}/san-pham/${slug}-${r.id}.html)`;
    });

    if (urls.length > 0) raw += `\n📦 Xem chi tiết:\n${urls.join("\n")}`;

    const refined = await refineSQLResponseChain.invoke({ raw, schema });
    console.log("✅ Refined result:", refined.content);
    return {
        refined: refined.content,
        resultMessage: raw,
        next_step: "responder"
    };
};

const responder = async ({ refined, messages, email, sql, dbRows }) => {
    await saveChatHistory({
        email,
        question: messages.at(-1)?.content || "",
        aiAnswer: refined,
        type: "sql",
        sql,
        dbRows
    });
    return {
        messages: [{ content: refined }]
    };
};

export const sqlPlannerGraph = new StateGraph(PlanningState)
    .addNode("sql_generator", sql_generator)
    .addNode("sql_executor", sql_executor)
    .addNode("result_refiner", result_refiner)
    .addNode("responder", responder)
    .addEdge("__start__", "sql_generator")
    .addConditionalEdges("sql_generator", s => s.next_step, { sql_executor: "sql_executor" })
    .addConditionalEdges("sql_executor", s => s.next_step, { result_refiner: "result_refiner", __end__: "__end__" })
    .addConditionalEdges("result_refiner", s => s.next_step, { responder: "responder", __end__: "__end__" })
    .addEdge("responder", "__end__")
    .compile();