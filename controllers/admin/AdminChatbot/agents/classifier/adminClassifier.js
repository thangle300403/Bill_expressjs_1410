import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-4o",
    temperature: 0,
});

export async function adminClassifier(state) {
    const res = await model.invoke([
        [
            "system",
            `
Bạn là AI phân loại yêu cầu của quản trị viên liên quan đến bình luận.

Chỉ phân loại thành **1 trong 2 nhóm** sau:
- "moderate": nếu admin muốn kiểm tra, phát hiện, lọc các bình luận độc hại, tiêu cực, spam, hoặc gây khó chịu.
- "summarize": nếu admin muốn tổng hợp hoặc tóm tắt xu hướng của các bình luận.

Trả lời duy nhất 1 từ: "moderate" hoặc "summarize".
`,
        ],
        ["human", `Yêu cầu từ quản trị viên: "${state.user_task}"`],
    ]);

    const answer = res.content?.trim().toLowerCase();
    console.log("🧠 Admin intent LLM classified as:", answer);

    return {
        next: ["moderate", "summarize"].includes(answer) ? answer : "summarize",
    };
}
