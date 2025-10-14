import { StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import { consultAgent } from "./agents/consult.js";
import { cancelAgent } from "./agents/cancel.js";
import { policyAgent } from "./agents/policy.js";
import { sqlPlannerGraph } from "./agents/sql.js";
import { intentClassifier } from "./agents/classifier.js";
import { addToCartNode } from "./nodes/addToCartNode.js";

const SupervisorState = z.object({
    messages: z.array(z.any()),
    original_user_msg: z.string().optional(),
    next: z.string().optional(),
    current_step: z.string().optional(),
    email: z.string(),
    history: z.array(z.any()).optional(),
    answered_intents: z.array(z.string()).optional(),
    used_tool: z.string().optional(),
    cartProduct: z.any().optional(),
    cartOutput: z.any().optional(),
});

export const supervisorGraph = new StateGraph(SupervisorState)
    .addNode("intent", intentClassifier)

    // CONSULT
    .addNode("consult", async (state) => {
        const result = await consultAgent({
            ...state,
            email: state.email,
            intent: state.next,
            answered_intents: state.answered_intents || [],
            used_tool: state.used_tool || null,
        });

        // Always append AI message to history for re-classification
        return {
            messages: [...state.messages, ...(result.messages || [])],
            answered_intents: result.answered_intents || state.answered_intents || [],
            original_user_msg: state.original_user_msg,
            history: [...(state.history || []), ...(result.messages || [])],
            current_step: result.current_step,
            used_tool: result.used_tool || state.used_tool || null,
            cartProduct: result.cartProduct,
            cartOutput: state.cartOutput,
        };
    })

    // POLICY
    .addNode("policy", async (state) => {
        const result = await policyAgent({
            ...state,
            email: state.email,
            intent: state.next,
            answered_intents: state.answered_intents || []
        });

        return {
            messages: [...state.messages, ...(result.messages || [])],
            answered_intents: result.answered_intents || state.answered_intents || [],
            original_user_msg: state.original_user_msg,
            history: [...(state.history || []), ...(result.messages || [])],
            current_step: "intent"
        };
    })

    // SQL
    .addNode("sql", async (state) => {
        const result = await sqlPlannerGraph.invoke({
            ...state,
            history: state.history || [],
            email: state.email,
            intent: state.next,
            answered_intents: state.answered_intents || []
        });

        return {
            messages: [...state.messages, ...(result.messages || [])],
            answered_intents: result.answered_intents || state.answered_intents || [],
            original_user_msg: state.original_user_msg,
            current_step: "intent"
        };
    })

    .addNode("add_to_cart", addToCartNode)

    // CANCEL
    .addNode("cancel", cancelAgent)

    .addEdge("__start__", "intent")

    // CLASSIFIER ROUTING
    .addConditionalEdges("intent", (state) => {
        console.log("📦 Supervisor routing: intent ->", state.next);
        console.log(`📝 answered_intents so far: ${state.answered_intents || []}`);

        return state.next;
    }, {
        consult: "consult",
        sql: "sql",
        cancel: "cancel",
        policy: "policy",
        __end__: "__end__"
    })

    // AGENTS LOOP BACK TO INTENT
    .addConditionalEdges("consult", s => s.current_step || "__end__", {
        intent: "intent",
        add_to_cart: "add_to_cart",
        __end__: "__end__"
    })
    .addConditionalEdges("sql", s => s.current_step || "__end__", {
        intent: "intent",
        __end__: "__end__"
    })
    .addConditionalEdges("cancel", () => "__end__", {
        __end__: "__end__"
    })
    .addConditionalEdges("policy", s => s.current_step || "__end__", {
        intent: "intent",
        __end__: "__end__"
    })
    .addConditionalEdges("add_to_cart", s => s.current_step || "__end__", {
        consult: "consult",
        intent: "intent",
        __end__: "intent",
    })

    .compile();
