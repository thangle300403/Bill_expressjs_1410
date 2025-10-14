// PLANNER AGENT: SQL with Plan-and-Execute Style using LangGraph

import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import { sql_generator } from "./sqlTools.js";
import { sql_executor } from "./sqlTools.js";
import { result_refiner } from "./sqlTools.js";
import { responder } from "./sqlTools.js";
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-4o",
    temperature: 0.3,
});

// === Planner Prompt Template ===
const plannerPrompt = ChatPromptTemplate.fromMessages([
    ["system", `
Bạn là AI lập kế hoạch để hoàn thành truy vấn SQL và trả lời khách hàng.
Hãy chọn bước tiếp theo cần thực hiện. Trả về duy nhất 1 từ trong số:

sql_generator, sql_executor, result_refiner, responder, __end__

QUY TẮC:
- KHÔNG được nhảy tới "responder" nếu chưa chạy các bước ở trên.
- Luôn bắt đầu với "sql_generator", trừ khi truy vấn đã sẵn.
- Nếu không chắc, trả về "sql_generator"
`],
    new MessagesPlaceholder("messages")
]);

const plannerChain = RunnableSequence.from([plannerPrompt, model]);

// === Planning State Schema ===
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
    intent: z.string().optional(),
    error: z.string().optional(),
});

// === Final Planner Graph ===
export const sqlPlannerGraph = new StateGraph(PlanningState)
    // === PLANNER ===
    .addNode("planner", async (state) => {
        console.log("📍 Entered: planner");

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
            return { current_step: "__end__" };
        }

        return { current_step: normalized };
    })

    .addEdge("__start__", "planner")

    // === MAIN BRANCHING LOGIC ===
    .addConditionalEdges("planner", s => s.current_step, {
        sql_generator: "sql_generator",
        sql_executor: "sql_executor",
        result_refiner: "result_refiner",
        responder: "responder",
        __end__: "__end__"
    })

    // === SQL GENERATOR ===
    .addNode("sql_generator", async (state) => {
        try {
            const result = await sql_generator(state);
            return { ...result };
        } catch (err) {
            console.error("❌ sql_generator failed:", err.message);
            return { current_step: "planner", error: err.message };
        }
    })
    .addConditionalEdges("sql_generator", s => s.current_step, {
        sql_executor: "sql_executor",
        planner: "planner",
        __end__: "__end__"
    })

    // === SQL EXECUTOR ===
    .addNode("sql_executor", async (state) => {
        try {
            const result = await sql_executor(state);
            return { ...result };
        } catch (err) {
            console.error("❌ sql_executor failed:", err.message);
            return { current_step: "planner", error: err.message };
        }
    })
    .addConditionalEdges("sql_executor", s => s.current_step, {
        result_refiner: "result_refiner",
        planner: "planner",
        __end__: "__end__"
    })

    // === RESULT REFINER ===
    .addNode("result_refiner", async (state) => {
        try {
            const result = await result_refiner({
                dbRows: state.dbRows,
                history: state.history,
                messages: state.messages,
                intent: state.intent,
                email: state.email,
            });
            return result;
        } catch (err) {
            console.error("❌ result_refiner failed:", err.message);
            return { current_step: "planner", error: err.message };
        }
    })
    .addConditionalEdges("result_refiner", s => s.current_step, {
        responder: "responder",
        planner: "planner",
        __end__: "__end__"
    })

    // === RESPONDER ===
    .addNode("responder", async (state) => {
        try {
            return await responder({
                refined: state.refined,
                messages: state.messages,
                email: state.email,
                sql: state.sql,
                dbRows: state.dbRows,
            });
        } catch (err) {
            console.error("❌ responder failed:", err.message);
            return { current_step: "planner", error: "responder failed: " + err.message };
        }
    })
    .addConditionalEdges("responder", s => s.current_step, {
        __end__: "__end__",
        planner: "planner" // 🌀 enables loop-back from responder
    })


    // === Compile Final Graph ===
    .compile();
