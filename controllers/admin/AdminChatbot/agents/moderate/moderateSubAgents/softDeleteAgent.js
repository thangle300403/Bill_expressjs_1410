import { ChatOpenAI } from "@langchain/openai";
import { loadSchema } from "../../../../../admin/schemaLoader.js";
import pool from "../../../../../../models/db.js";
import { extractSQL } from "../../../../../api/Chatbot/extra/parser.js";

const model = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-4o",
    temperature: 0.2,
});

export async function softDeleteAgent({ flagged, messages }) {
    const schema = await loadSchema();

    const summaryPrompt = `
Bạn là AI hỗ trợ xử lý bình luận vi phạm.

== MÔ TẢ CƠ SỞ DỮ LIỆU ==
${schema}

== DỮ LIỆU BỊ GẮN CỜ ==
${(flagged || [])
            .map((c) => `- ID: ${c.id}, Nội dung: ${c.description}`)
            .join("\n")}

== YÊU CẦU ADMIN ==
"${messages.at(-1)?.content}"

== HƯỚNG DẪN ==
Chỉ sinh câu lệnh SQL nếu admin yêu cầu "xóa", "delete", "loại bỏ"... 

- KHÔNG giải thích. Trả về duy nhất 1 block SQL bên trong:
\`\`\`sql
DELETE FROM ...
\`\`\`
`;

    const result = await model.invoke(summaryPrompt);
    const raw = result.content.trim();
    const sql = extractSQL(raw);

    console.log("🧠 Raw LLM Output:\n", raw);
    console.log("🧠 Extracted SQL:", sql);

    if (sql?.toLowerCase().startsWith("delete")) {
        try {
            const [rows] = await pool.query(sql);
            const affected = rows.affectedRows || 0;

            console.log("✅ Rows affected:", affected);
            console.log("🧠 AI đã thực thi SQL:", sql);

            const idMatch = sql?.match(/[`"]?id[`"]?\s*=\s*(\d+)/i);
            const id = idMatch ? parseInt(idMatch[1]) : null;

            return {
                sql,
                deleted_count: affected,
                deleted: id ? [{ id }] : [],
                summary: `✅ Đã thực thi lệnh xóa bằng AI:\n${sql}`,
                current_step: "__end__"
            };
        } catch (err) {
            return {
                summary: `❌ Lỗi khi thực thi SQL:\n${err.message}`,
                current_step: "__end__"
            };
        }
    } else {
        return {
            summary: `ℹ️ Không có câu lệnh DELETE hợp lệ.\nĐầu ra AI:\n${raw}`,
            current_step: "__end__"
        };
    }
}
