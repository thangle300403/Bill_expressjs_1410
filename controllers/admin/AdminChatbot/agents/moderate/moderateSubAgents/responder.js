import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-4o",
    temperature: 0.3,
});

export async function responder({ deleted, deleted_count, flagged, sql, question, comments = [] }) {
    const flaggedCount = flagged?.length || 0;
    const deletedCount = deleted?.length || deleted_count || 0;
    const deletedIds = deleted?.map(c => c.id).join(", ") || (sql?.match(/id\s*=\s*(\d+)/i)?.[1] || "");
    const flaggedDescriptions = (flagged || [])
        .map(c => `- ID ${c.id}: ${c.description}`)
        .join("\n") || "Không có";

    console.log("Ques:", question);
    console.log("Flagged count:", flaggedCount);
    console.log("Deleted count:", deletedCount);
    console.log("Deleted ids:", deletedIds);
    console.log("SQL trong response:", sql);

    const prompt = `
Bạn là trợ lý AI hỗ trợ quản lý bình luận.

== YÊU CẦU ADMIN ==
"${question}"

== KẾT QUẢ XỬ LÝ ==
- Số bình luận vi phạm: ${flaggedCount}
- Số bình luận đã xóa: ${deletedCount}
- ID đã xóa: ${deletedIds || "Không có"}
- SQL đã thực thi (nếu có): ${sql || "Không có"}

== BÌNH LUẬN VI PHẠM ==
${flaggedDescriptions}

== HƯỚNG DẪN ==
- Nếu có thấy sql thì nói là đã xóa bình luận có id = ... 

== YÊU CẦU PHẢN HỒI ==
Viết câu trả lời thân thiện, gọn gàng (1–2 dòng) để hiển thị cho admin.
Hãy nêu ra các bình luận vi phạm bao gồm id và nội dung (nếu có).
Không cần nhắc lại câu hỏi.
Không giải thích logic.
Không ghi "mình", "tôi" hay "bạn", hãy dùng ngôn ngữ trung lập.
`;


    const response = await model.invoke(prompt);
    const summary = response.content.trim();

    return {
        summary,
        current_step: "__end__"
    };
}
