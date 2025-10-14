import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-4o",
    temperature: 0.3,
});

export async function classifyToxicAgent({ comments }) {
    const flagged = [];

    for (const comment of comments) {
        const prompt = `
Đánh giá bình luận sau có độc hại, xúc phạm hoặc tiêu cực hay không.

Trả lời duy nhất một từ: "có" hoặc "không".

Bình luận: "${comment.description}"
`;

        const res = await model.invoke(prompt);
        const answer = res.content.trim().toLowerCase();

        if (answer.includes("có")) {
            flagged.push(comment);
        }
    }

    console.log("🧠 Toxic comments:", flagged.length);

    return { flagged };
}
