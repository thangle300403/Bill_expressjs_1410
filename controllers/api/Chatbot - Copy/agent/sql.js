// PLANNER AGENT: SQL with Plan-and-Execute Style using LangGraph

import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import { sql_generator } from "./sqlAgents.js"
import { sql_executor } from "./sqlAgents.js"
import { result_refiner } from "./sqlAgents.js"
import { responder } from "./sqlAgents.js"
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-4o",
    temperature: 0.3,
});

// === STEP 1: Planner generates next step ===
const plannerPrompt = ChatPromptTemplate.fromMessages([
    ["system", `
        Bạn là AI lập kế hoạch để hoàn thành truy vấn SQL và trả lời khách hàng. Hãy chọn bước tiếp theo cần thực hiện.
Trả về duy nhất 1 từ trong số: sql_generator, sql_executor, result_refiner, responder, __end__

QUY TẮC:
- KHÔNG được nhảy tới "responder" nếu chưa chạy các bước ở trên.
- Luôn bắt đầu với "sql_generator", trừ khi truy vấn đã sẵn.
- Nếu không chắc, trả về "sql_generator"
`],
    new MessagesPlaceholder("messages")
]);

const plannerChain = RunnableSequence.from([plannerPrompt, model]);

const PlanningState = z.object({
    messages: z.array(z.any()),
    current_step: z.string().optional(),
    schema: z.string(),
    sql: z.string().optional(),
    dbRows: z.array(z.any()).optional(),
    resultMessage: z.string().optional(),
    refined: z.string().optional(),
    email: z.string(),
    history: z.array(z.any()).optional(),
    intent: z.string().optional()
});

// === Final Planner Graph ===
export const sqlPlannerGraph = new StateGraph(PlanningState)
    .addNode("planner", async (state) => {
        const step = await plannerChain.invoke({ messages: state.messages });
        const raw = step.content.trim();
        const normalized = raw.toLowerCase();

        const allowed = [
            "sql_generator",
            "sql_executor",
            "result_refiner",
            "responder",
            "__end__"
        ];

        console.log("🧭 Planner raw step:", raw);
        console.log("✅ Normalized step:", normalized);

        if (!allowed.includes(normalized)) {
            console.warn("❌ Planner returned unknown step:", normalized);
            return { current_step: "__end__" }; // fallback to prevent crash
        }

        return { current_step: normalized };
    })
    .addEdge("__start__", "planner")
    .addConditionalEdges("planner", s => s.current_step, {
        sql_generator: "sql_generator",
        sql_executor: "sql_executor",
        result_refiner: "result_refiner",
        responder: "responder",
        __end__: "__end__"
    })
    .addNode("sql_generator", sql_generator)
    .addNode("sql_executor", sql_executor)
    .addNode("result_refiner", async (state) => {
        return await result_refiner({
            dbRows: state.dbRows,
            history: state.history,
            messages: state.messages,
            intent: state.intent,
            email: state.email,
        });
    })
    .addNode("responder", responder)
    .addConditionalEdges("sql_generator", s => s.current_step, {
        sql_executor: "sql_executor",
        __end__: "__end__"
    })
    .addConditionalEdges("sql_executor", s => s.current_step, {
        result_refiner: "result_refiner",
        __end__: "__end__"
    })
    .addConditionalEdges("result_refiner", s => s.current_step, {
        responder: "responder",
        __end__: "__end__"
    })
    .addEdge("responder", "__end__")
    .compile();
