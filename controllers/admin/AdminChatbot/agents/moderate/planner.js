import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { classifySpamAgent } from "../moderate/moderateSubAgents/classifySpamAgent.js"
import { classifyToxicAgent } from "../moderate/moderateSubAgents/classifyToxicAgent.js";
import { softDeleteAgent } from "../moderate/moderateSubAgents/softDeleteAgent.js";
import { responder } from "../moderate/moderateSubAgents/responder.js";

const model = new ChatOpenAI({ modelName: "gpt-4o", temperature: 0 });

const plannerPrompt = ChatPromptTemplate.fromMessages([
    ["system", `
Bạn là AI lập kế hoạch xử lý bình luận vi phạm cho admin.

Trả về một danh sách JSON các bước cần thực hiện. Mỗi phần tử là một chuỗi.

Các bước hợp lệ gồm:
- classify_spam → kiểm tra spam
- classify_toxic → kiểm tra bình luận tiêu cực
- soft_delete → chỉ thêm nếu admin yêu cầu xóa
- responder → trả lời kết quả cho admin

Chỉ thêm bước "soft_delete" nếu admin có sử dụng các từ như: "xóa", "loại bỏ", "delete", "remove", hoặc yêu cầu hành động rõ ràng, không chỉ kiểm tra.

Ví dụ:
- "Kiểm tra bình luận spam" → ["classify_spam", "responder"]
- "Xóa các bình luận tiêu cực" → ["classify_toxic", "soft_delete", "responder"]

Chỉ trả về JSON array. Không giải thích.
`],
    new MessagesPlaceholder("messages")
]);


const plannerChain = RunnableSequence.from([plannerPrompt, model]);

export async function planSteps(state) {
    const stepListRaw = await plannerChain.invoke({ messages: state.messages });

    try {
        const plan = JSON.parse(stepListRaw.content);
        console.log("🧠 Planner plan:", plan);
        return {
            plan,
            current_step_index: 0
        };
    } catch (err) {
        console.error("❌ Kế hoạch không phải JSON hợp lệ:", stepListRaw.content);
        return { plan: [], current_step_index: -1 };
    }
}

export async function executeStep(state) {
    const currentStep = state.plan?.[state.current_step_index];
    console.log("▶️ Executing step:", currentStep);

    const agentMap = {
        classify_spam: classifySpamAgent,
        classify_toxic: classifyToxicAgent,
        soft_delete: softDeleteAgent,
        responder
    };

    const agent = agentMap[currentStep];
    if (!agent) return { current_step_index: -1 };

    const result = await agent(state);

    return {
        ...state,
        ...result,
        current_step_index: state.current_step_index + 1
    };
}

