import { StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import { moderationPlannerGraph } from "../agents/moderate/moderatePlannerGraph.js";
import { adminSummaryAgent } from "../agents/summary/insightSummary.js";
import { adminClassifier } from "../agents/classifier/adminClassifier.js";

// Shared state schema
const AdminState = z.object({
    user_task: z.string(),
    question: z.string(),
    comments: z.array(z.any()),
    messages: z.array(z.any()).optional(),
    flagged: z.array(z.any()).optional(),
    deleted: z.array(z.any()).optional(),
    summary: z.string().optional(),
    next: z.string().optional(),
    plan: z.array(z.string()).optional(),
    current_step_index: z.number().optional()
});



export const adminSupervisorGraph = new StateGraph(AdminState)
    .addNode("intent", adminClassifier) // ✅ uses LLM now
    .addNode("moderate", async (state) => {
        const result = await moderationPlannerGraph.invoke({
            messages: [{ role: "user", content: state.user_task }],
            comments: state.comments,
            question: state.user_task
        });
        return {
            ...state,
            ...result
        };
    })
    .addNode("summarize", adminSummaryAgent)
    .addEdge("__start__", "intent")
    .addConditionalEdges("intent", (state) => state.next, {
        moderate: "moderate",
        summarize: "summarize"
    })
    .addEdge("moderate", "__end__")
    .addEdge("summarize", "__end__")
    .compile();
