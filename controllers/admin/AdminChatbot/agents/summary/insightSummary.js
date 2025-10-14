import { ChatOpenAI } from "@langchain/openai";
const model = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-4o",
    temperature: 0.3,
});
export async function adminSummaryAgent({ comments }) {
    const block = comments.map(c => `• ${c.description}`).join("\n");
    const res = await model.invoke(`Tóm tắt nội dung các bình luận sau:\n${block}`);
    console.log("🧠 Summary:", res.content);
    return { summary: res.content };
}
