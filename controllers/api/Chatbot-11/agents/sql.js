// PLANNER AGENT: SQL with Plan-and-Execute Style using LangGraph

import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import { sql_generator } from "./sqlTools.js";
import { sql_executor } from "./sqlTools.js";
import { result_refiner } from "./sqlTools.js";
import { responder } from "./sqlTools.js";
import { model } from "../../../../controllers/api/Chatbot/llm.js";


// === Planner Prompt Template ===
const plannerPrompt = ChatPromptTemplate.fromMessages([
    ["system", `
Bạn là AI lập kế hoạch để hoàn thành truy vấn có sở dữ liệu và trả lời khách hàng.
Hãy nhớ giới thiệu bạn.
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
    original_user_msg: z.string(),
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
    answered_intents: z.array(z.string()).optional(),
    session_id: z.string().optional()
});

// === Final Planner Graph ===
export const sqlPlannerGraph = new StateGraph(PlanningState)
    // === PLANNER ===
    .addNode("sql_planner", async (state) => {
        console.log("📍 Entered: sql_planner !!!!!!!!!!!!");

        if ((state.answered_intents || []).includes("sql")) {
            console.log("🛑 'sql' intent already answered, skipping planner.");
            return { current_step: "__end__" };
        }

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

        console.log("🧭sql Planner raw step:", raw);
        console.log("✅sql Normalized step:", normalized);

        if (!allowed.includes(normalized)) {
            console.warn("❌ Planner returned unknown step:", normalized);
            return { current_step: "__end__" };
        }

        return { current_step: normalized };
    })

    .addEdge("__start__", "sql_planner")

    // === MAIN BRANCHING LOGIC ===
    .addConditionalEdges("sql_planner", s => s.current_step, {
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
            return {
                ...result,
                answered_intents: [...new Set([...(state.answered_intents || []), ...(result.answered_intents || [])])]
            };
        } catch (err) {
            return { current_step: "sql_planner", error: err.message };
        }
    })

    .addConditionalEdges("sql_generator", s => s.current_step, {
        sql_executor: "sql_executor",
        sql_planner: "sql_planner",
        __end__: "__end__"
    })

    // === SQL EXECUTOR ===
    .addNode("sql_executor", async (state) => {
        try {
            const result = await sql_executor(state);
            return {
                ...result,
                answered_intents: [...new Set([...(state.answered_intents || []), ...(result.answered_intents || [])])]
            };
        } catch (err) {
            return { current_step: "sql_planner", error: err.message };
        }
    })

    .addConditionalEdges("sql_executor", s => s.current_step, {
        result_refiner: "result_refiner",
        sql_planner: "sql_planner",
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
                session_id: state.session_id,
                answered_intents: state.answered_intents || [], // THÊM
            });

            return {
                ...result,
                answered_intents: [...new Set([...(state.answered_intents || []), ...(result.answered_intents || [])])]
            };
        } catch (err) {
            return { current_step: "sql_planner", error: err.message };
        }
    })

    .addConditionalEdges("result_refiner", s => s.current_step, {
        responder: "responder",
        sql_planner: "sql_planner",
        __end__: "__end__"
    })

    // === RESPONDER ===
    .addNode("responder", async (state) => {
        try {
            const result = await responder({
                refined: state.refined,
                messages: state.messages,
                email: state.email,
                sql: state.sql,
                dbRows: state.dbRows,
                answered_intents: state.answered_intents || [],
                original_user_msg: state.original_user_msg,
            });

            return {
                ...result,
                answered_intents: [...new Set([...(state.answered_intents || []), ...(result.answered_intents || [])])]
            };
        } catch (err) {
            return { current_step: "sql_planner", error: "responder failed: " + err.message };
        }
    })

    .addConditionalEdges("responder", s => s.current_step, {
        __end__: "__end__",
        sql_planner: "sql_planner"
    })

    // === Compile Final Graph ===
    .compile();
