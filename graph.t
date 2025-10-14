import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import productModel from "../../../models/Product.js"; // ✅ your model
import { StateGraph } from "@langchain/langgraph";
import pool from "../../../models/db.js";
import { extractSQL } from "./parser.js";
import { loadSchema } from "./schemaLoader.js";
import { z } from "zod";
import slugify from "slugify";
import { saveChatHistory } from "./saveChatHistory.js";

const model = new ChatGoogleGenerativeAI({
    model: "gemini-1.5-pro",
    apiKey: process.env.GEMINI_API_KEY,
    temperature: 0.3,
});

async function intentClassifier({ messages, email }) {
    const lastMsg = messages[messages.length - 1]?.content;

    const intent = await model.invoke([
        ["system", `
            Bạn là bộ phân loại intent. Hãy phân loại câu hỏi khách thành 1 trong 4 nhóm: 
- **consult**: khách muốn tư vấn chọn sản phẩm phù hợp với nhu cầu.
- **sql**: khách muốn truy vấn dữ liệu (liệt kê đơn hàng, sản phẩm giảm giá, sản phẩm đã mua...).
- **cancel**: khách muốn hủy đơn hàng.
- **policy**: khách hỏi về chính sách đổi trả, giao hàng, bảo hành.
Trả về duy nhất 1 từ: consult, sql, policy, hoặc cancel.
`],
        ["human", `Câu hỏi của khách: "${lastMsg}", Email của khách: "${email}". Chỉ trả về 1 từ: consult, sql, policy hoặc cancel.`]
    ]);

    const result = intent.content?.trim().toLowerCase();
    console.log("Guest question:", lastMsg);
    console.log("🟨 Raw AI intent result:", intent.content);
    console.log("✅ Parsed intent:", result);

    return {
        messages,
        next: result // ✅ explicitly included in returned state
    };
}

//CONSULTAGENT

const consultPromptTemplate = ChatPromptTemplate.fromMessages([
    ["system", `
Bạn là trợ lý AI tư vấn cầu lông của shop.
Am hiểu tất cả những kiến thức về cầu lông.
Trả lời ngắn gọn, thân thiện.
Chỉ tư vấn các sản phẩm liên quan đến câu hỏi khách.
Gợi ý đúng trình độ người chơi và giá hợp lý.
Nếu khách hỏi mơ hồ, hãy hỏi lại rõ nhu cầu.
Sản phẩm đang bán:
{productList}
  `],
    new MessagesPlaceholder("messages"),
]);

const consultChain = RunnableSequence.from([consultPromptTemplate, model]);

async function consultAgent({ messages, email }) {
    const products = await productModel.getAll();

    const productList = products
        .map(p => `${p.name} (giá ${p.price}đ)`)
        .join(", ");

    const response = await consultChain.invoke({
        messages,
        productList,
    });

    const aiText = response.content;

    // Auto-match product names mentioned in AI response
    const matched = products.filter(p =>
        aiText.toLowerCase().includes(p.name.toLowerCase())
    );

    let productDetailUrls = "";
    if (matched.length > 0) {
        const urls = matched.map(p => {
            const slug = slugify(p.name, { lower: true });
            const url = `${process.env.FRONTEND_URL}/san-pham/${slug}-${p.id}.html`;
            return `[${p.name}](${url})`;
        });
        productDetailUrls = `\n📦 Xem chi tiết:\n${urls.join("\n")}`;
    }

    console.log("✅ product url:", productDetailUrls);

    await saveChatHistory({
        email,
        question: messages[messages.length - 1]?.content || "",
        aiAnswer: aiText + productDetailUrls,
        type: "consult",
        sql: null,
        dbRows: []
    });


    return {
        messages: [{ content: aiText + productDetailUrls }]
    };
}

//SQLAGENT

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
    ["human", `
Email người dùng hiện tại là: {email}`],
    new MessagesPlaceholder("messages"),
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

async function sqlAgent({ messages, email }) {
    const schema = await loadSchema();

    const response = await sqlChain.invoke({
        messages,
        schema,
        email,
    });

    const sql = extractSQL(response.content);
    console.log("🧠 AI SQL:", sql);

    let dbRows = [];
    try {
        if (sql) {
            [dbRows] = await pool.execute(sql);
        }
    } catch (err) {
        return {
            messages: [{ content: `❌ Lỗi SQL: ${err.message}` }]
        };
    }

    console.log("✅ DB rows:", dbRows);

    // Generate product URLs if applicable
    let productDetailUrl = "";
    if (Array.isArray(dbRows) && dbRows.length > 0) {
        const urls = dbRows
            .filter(row => row.id && row.name)
            .map(row => {
                const slug = slugify(row.name, { lower: true });
                const url = `${process.env.FRONTEND_URL}/san-pham/${slug}-${row.id}.html`;
                return `[${row.name}](${url})`;
            });

        if (urls.length > 0) {
            productDetailUrl = `\n📦 Xem chi tiết:\n${urls.join("\n")}`;
        }
    }

    console.log("✅ product url:", productDetailUrl);

    let resultMessage = "⚠️ Không có dữ liệu phù hợp.";

    if (dbRows.length > 0) {
        const headers = Object.keys(dbRows[0]).join(" | ");
        const rows = dbRows.map(row => Object.values(row).join(" | ")).join("\n");
        resultMessage = `✅ Kết quả:\n${headers}\n${rows}${productDetailUrl}`;
    }

    console.log('resultMessage', resultMessage);

    const refined = await refineSQLResponseChain.invoke({
        raw: resultMessage,
        schema
    });

    console.log("✅ AI response:", refined.content);

    await saveChatHistory({
        email,
        question: messages.at(-1)?.content || "",
        aiAnswer: refined.content,
        type: "sql",
        sql,
        dbRows
    });

    return { messages: [{ content: refined.content }] };

}

//CANCELAGENT

const cancelPrompt = ChatPromptTemplate.fromMessages([
    ["system", `
Bạn là trợ lý AI xử lý yêu cầu hủy đơn hàng.

        Luật:
    - Nếu khách muốn hủy đơn, trả về: HUY < mã đơn >
    - Nếu khách xác nhận, trả về: CONFIRM < mã đơn >
    - Nếu khách từ chối, trả về: CANCEL
    - Nếu không hiểu, trả về: UNKNOWN

Ví dụ:
    Khách: "Tôi muốn hủy đơn hàng 12" → HUY 12
Khách: "[XÁC NHẬN HỦY ĐƠN HÀNG SỐ 12]" → CONFIRM 12
Khách: "[KHÔNG HỦY]" → CANCEL
Khách: "Tôi cần tư vấn thêm" → UNKNOWN
        `],
    new MessagesPlaceholder("messages")
]);

const cancelChain = RunnableSequence.from([cancelPrompt, model]);

async function cancelAgent({ messages, email }) {
    const response = await cancelChain.invoke({ messages });
    const result = response.content.trim();

    const confirmMatch = result.match(/^CONFIRM (\d+)/i);
    const huyMatch = result.match(/^HUY (\d+)/i);

    if (confirmMatch) {
        const orderId = confirmMatch[1];
        try {
            await pool.execute("UPDATE `order` SET order_status_id = 6 WHERE id = ?", [orderId]);

            const aiAnswer = `✅ Đã hủy đơn hàng số ${orderId} thành công.Chúc quý khách một ngày tốt lành.`;
            await saveChatHistory({ email, question: messages.at(-1).content, aiAnswer, type: "cancel", sql: `UPDATE order SET order_status_id = 6 WHERE id = ${orderId}`, dbRows: [] });

            return { messages: [{ content: aiAnswer }] };
        } catch (err) {
            return { messages: [{ content: `❌ Lỗi khi hủy đơn: ${err.message}` }] };
        }
    }

    if (huyMatch) {
        const orderId = huyMatch[1];
        const aiAnswer = `Bạn có chắc muốn hủy đơn hàng số ${orderId} không ?\nVui lòng xác nhận bằng: [XÁC NHẬN HỦY ĐƠN HÀNG SỐ ${orderId}] hoặc[KHÔNG HỦY]`;

        await saveChatHistory({ email, question: messages.at(-1).content, aiAnswer, type: "cancel", sql: null, dbRows: [] });

        return { messages: [{ content: aiAnswer }] };
    }

    if (result === "CANCEL") {
        const aiAnswer = "Chúc quý khách một ngày tốt lành.";
        await saveChatHistory({ email, question: messages.at(-1).content, aiAnswer, type: "cancel", sql: null, dbRows: [] });
        return { messages: [{ content: aiAnswer }] };
    }

    const fallback = "Xin hãy cung cấp mã đơn hàng cần hủy, ví dụ: 'hủy đơn hàng số 123'";
    await saveChatHistory({ email, question: messages.at(-1).content, aiAnswer: fallback, type: "cancel", sql: null, dbRows: [] });
    return { messages: [{ content: fallback }] };
}

async function shouldContinue({ messages }) {
    return "__end__";
}

const SupervisorState = z.object({
    messages: z.array(z.any()),
    next: z.string().optional(),
    email: z.string(),
});


export const supervisorGraph = new StateGraph(SupervisorState)
    .addNode("intent", intentClassifier)
    .addNode("consult", consultAgent)
    .addNode("sql", sqlAgent)
    .addNode("cancel", cancelAgent)
    .addEdge("__start__", "intent")
    .addConditionalEdges("intent", (state) => {
        console.log("📦 Routing intent state.next:", state.next);
        return state.next;
    }, {
        consult: "consult",
        sql: "sql",
        cancel: "cancel",
    })
    .addEdge("consult", "__end__")
    .addEdge("sql", "__end__")
    .addEdge("cancel", "__end__")
    .compile();
