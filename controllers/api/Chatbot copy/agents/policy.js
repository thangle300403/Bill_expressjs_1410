// POLICYAGENT
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { saveChatHistory } from "../memory/saveChatHistory.js";
import aiChatbotModel from "../../../../models/Chatbot.js";
import { encrypt } from "../extra/encrypt.js";
import { ChatOpenAI } from "@langchain/openai";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";

const model = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-4o",
    temperature: 0.3,
});

const policyPromptTemplate = ChatPromptTemplate.fromMessages([
    ["system", `
Bạn là trợ lý AI của cửa hàng, chuyên trả lời các câu hỏi liên quan đến chính sách như: đổi trả, bảo hành, thanh toán, vận chuyển...

Luật:
- Trả lời đúng, rõ ràng, dễ hiểu
- Trích đúng nội dung từ chính sách trong schema nếu cần
- Nếu không chắc, hãy trả lời lịch sự rằng bạn chưa có thông tin

Chính sách của shop (schema):
{schema}

Lịch sử giao tiếp (nếu có): {historyFormatted}
  `],
    new MessagesPlaceholder("messages"),
]);

const policyChain = RunnableSequence.from([policyPromptTemplate, model]);

export async function policyAgent({ messages, email, history, intent }) {
    const embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const vectorStore = new Chroma(embeddings, {
        collectionName: "policy_docs",
        url: "http://localhost:8000",
    });

    const userQuestion = messages.at(-1)?.content || "";
    const similarDocs = await vectorStore.similaritySearch(userQuestion, 3);
    const schema = similarDocs.map(doc => doc.pageContent).join("\n\n");

    const encryptedMessage = encrypt(intent);
    const rawHistory = await aiChatbotModel.findByMessageAndEmail(encryptedMessage, email);

    const historyFormatted = rawHistory.map(row => {
        return `KH: ${row.question}\nAI: ${row.ai_answer}`;
    }).join("\n");

    const response = await policyChain.invoke({
        messages,
        schema,
        historyFormatted,
    });

    const aiText = response.content;

    await saveChatHistory({
        email,
        question: messages.at(-1)?.content || "",
        aiAnswer: aiText,
        type: "policy",
        sql: null,
        dbRows: []
    });

    return {
        messages: [{ content: aiText }],
    };
}
