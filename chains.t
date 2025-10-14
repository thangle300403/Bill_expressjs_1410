// chatbot/chains.js

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { RunnableSequence } from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";
import { systemPromptTemplate } from "./prompt.js";

// 1. Init Gemini model
const model = new ChatGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
    model: "gemini-1.5-pro",
});

// 2. Main SQL generation chain (uses imported systemPromptTemplate)
export const generateSQLChain = RunnableSequence.from([
    systemPromptTemplate,
    model,
]);

// 3. Refinement chain
const refinePrompt = new PromptTemplate({
    template: `
Dưới đây là câu hỏi của khách: "{question}"
SQL bạn đã tạo:
\`\`\`sql
{sql}
\`\`\`
Kết quả từ database: {dbRows}

Chi tiết về thông báo cuối cùng:
Nếu như khách hàng hỏi không liên quan đến việc thực thi sql ví dụ như chính sách thì hãy trả lời đầy đủ.
Khi khách hàng yêu cầu hủy đơn chỉ cần trả lời "Hãy điền lựa chọn vào khung chat."
Đây là các câu hỏi mà khách từng hỏi: {historyQues}, có thể dựa vào đây để học về khách hàng.
Khi có {productDetailUrl} thì hãy hiện lên.
Khi thấy khách hàng có yêu cầu [XÁC NHẬN HỦY ĐƠN HÀNG SỐ ...] thì hiện lên "Đã hủy đơn ... thành công", [KHÔNG HỦY] thì hiện Chúc quí khách 1 ngày tốt lành .` ,


    inputVariables: ["question", "sql", "dbRows", "historyQues", "productDetailUrl"],
});

export const refineAnswerChain = RunnableSequence.from([
    refinePrompt,
    model,
]);
