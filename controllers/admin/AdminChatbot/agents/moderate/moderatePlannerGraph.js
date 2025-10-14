import { StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import { planSteps, executeStep } from "./planner.js";

const ModerationState = z.object({
    messages: z.array(z.any()),
    question: z.string(),
    comments: z.array(z.any()),
    flagged: z.array(z.any()).optional(),
    deleted: z.array(z.any()).optional(),
    summary: z.string().optional(),
    plan: z.array(z.string()).optional(),
    current_step_index: z.number().optional()
});

export const moderationPlannerGraph = new StateGraph(ModerationState)
    .addNode("planner", planSteps)
    .addNode("executor", executeStep)
    .addEdge("__start__", "planner")
    .addConditionalEdges("planner", () => "executor")
    .addConditionalEdges("executor", (state) => {
        return (state.current_step_index ?? -1) >= (state.plan?.length ?? 0)
            ? "__end__"
            : "executor";
    })
    .compile();

