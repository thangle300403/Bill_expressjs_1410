// POLICYAGENT
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import aiChatbotModel from "../../../../models/Chatbot.js";
import { encrypt } from "../extra/encrypt.js";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";
import { model } from "../../../../controllers/api/Chatbot/llm.js";
import { pushLog } from "../extra/sseLogs.js";
import { saveChatHistory } from "../memory/saveChatHistory.js";

const policyPromptTemplate = ChatPromptTemplate.fromMessages([
    [
        "system",
        `
Bạn là TRỢ LÝ CHÍNH SÁCH của cửa hàng. CHỈ trả lời những nội dung thuộc NHÓM CHÍNH SÁCH: đổi trả, bảo hành, vận chuyển, thanh toán, hoàn tiền, xuất hóa đơn, bảo mật.
Hãy nhớ giới thiệu bạn.
⚠️ PHẠM VI BẮT BUỘC:
- KHÔNG tư vấn sản phẩm, không gợi ý vợt/giày/phụ kiện, không nói về giá, thông số kỹ thuật, size, trình độ chơi. 
- Nếu câu hỏi chứa cả phần chính sách và phần không thuộc chính sách, CHỈ trả lời phần chính sách, và không nói gì thêm.

CÁCH TRẢ LỜI:
- Ngắn gọn, rõ ràng, gạch đầu dòng khi cần.
- Nếu thiếu dữ liệu, nói lịch sự “Hiện mình chưa có thông tin để trả lời chính xác phần chính sách này.”

TRÍCH DẪN:
- Có thể trích đoạn từ policy schema nếu cần, nhưng đừng lặp dài dòng.

VÍ DỤ:
- KH: "Chính sách đổi trả và gợi ý vợt cho người mới chơi?"
  → TL: (Chỉ nêu điều kiện/ thời hạn đổi trả) không nói gì thêm”
- KH: "Bảo hành ra sao? Và nên chọn size giày nào?"
  → TL: (Chỉ nêu bảo hành) .
  - KH: "Vợt yonex duora 10 dành cho trình nào?"
  → TL: "" .

Schema (nội dung chính sách):
{schema}

Lịch sử giao tiếp (nếu có):
{historyFormatted}
    `.trim(),
    ],
    new MessagesPlaceholder("messages"),
]);

const policyChain = RunnableSequence.from([policyPromptTemplate, model]);

export async function policyAgent({ messages, email, history, session_id, intent, answered_intents = [], original_user_msg }) {
    try {
        const logKey = email || session_id;
        const log = (msg, step = null) => pushLog(logKey, { msg, step });
        console.log("🚧 policyAgent running !!!!!!!!!!!!");
        log("Trợ lí đang tìm hiểu về chính sách", "intent-policy");

        const embeddings = new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY,
        });

        const vectorStore = new Chroma(embeddings, {
            collectionName: "policies",
            url: process.env.CHROMA_URL,
        });

        const userQuestion = messages.at(-1)?.content || "";
        const similarDocs = await vectorStore.similaritySearch(userQuestion, 3);
        const schema = similarDocs.map(doc => doc.pageContent).join("\n\n");

        const historyFormatted = (history || [])
            .map((msg, idx) => {
                if (msg.role === "user") {
                    const next = history[idx + 1];
                    if (next?.role === "ai") {
                        return `KH: ${msg.content}\nAI: ${next.content}`;
                    }
                }
                return null;
            })
            .filter(Boolean)
            .join("\n");

        const response = await policyChain.invoke({
            messages,
            schema,
            historyFormatted,
        });

        const aiText = response.content;

        if (aiText && aiText.trim()) {
            await saveChatHistory({
                email,
                session_id,
                role: "ai",
                content: aiText,
            });
        }

        return {
            messages: [...messages, { role: "ai", content: aiText }],
            answered_intents: [...(answered_intents || []), "policy"],
            current_step: "intent",
        };
    } catch (error) {
        console.error("❌ policyAgent failed:", error.message);
        return {
            current_step: "intent",
            error: "policyAgent failed: " + error.message,
        };
    }
}
