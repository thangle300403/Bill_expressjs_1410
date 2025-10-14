
import { StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import { consultAgent } from "./agents/consult.js"
import { cancelAgent } from "./agents/cancel.js"
import { policyAgent } from "./agents/policy.js"
import { sqlPlannerGraph } from "./agents/sql.js"
import { intentClassifier } from "./agents/classifier.js"


async function shouldContinue({ messages }) {
    return "__end__";
}

const SupervisorState = z.object({
    messages: z.array(z.any()),
    next: z.string().optional(),
    email: z.string(),
    history: z.array(z.any()).optional()
});

export const supervisorGraph = new StateGraph(SupervisorState)
    .addNode("intent", intentClassifier)
    .addNode("consult", async (state) => {
        return await consultAgent({
            ...state,
            email: state.email,
            intent: state.next
        });
    })
    .addNode("sql", async (state) => {
        return await sqlPlannerGraph.invoke({
            ...state,
            history: state.history || [],
            email: state.email,
            intent: state.next
        });
    })
    .addNode("cancel", cancelAgent)
    .addNode("policy", async (state) => {
        return await policyAgent({
            ...state,
            email: state.email,
            intent: state.next
        });
    })
    .addEdge("__start__", "intent")
    .addConditionalEdges("intent", (state) => {
        console.log("📦 Routing intent state.next:", state.next);
        return state.next;
    }, {
        consult: "consult",
        sql: "sql",
        cancel: "cancel",
        policy: "policy"
    })
    .addEdge("consult", "__end__")
    .addEdge("sql", "__end__")
    .addEdge("cancel", "__end__")
    .addEdge("policy", "__end__")
    .compile();
