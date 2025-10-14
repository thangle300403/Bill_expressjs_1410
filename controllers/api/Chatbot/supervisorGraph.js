import { StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import { consultAgent } from "./agents/consult.js";
import { cancelAgent } from "./agents/cancel.js";
import { policyAgent } from "./agents/policy.js";
import { runSqlAgent } from "./agents/sql.js";
import { intentClassifier } from "./agents/classifier.js";
import { addToCartNode } from "./nodes/addToCartNode.js";
import { matchProductNode } from "./nodes/matchProductNode.js";

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
    session_id: z.string().optional(),
    topMatchedProduct: z.any().optional(),
    matchedProdInUserQues: z.any().optional(),
});

export const supervisorGraph = new StateGraph(SupervisorState)
    .addNode("intent", intentClassifier)

    // CONSULT
    .addNode("consult", async (state) => {
        const result = await consultAgent({
            ...state,
            email: state.email,
            intent: state.next,
            session_id: state.session_id,
            answered_intents: state.answered_intents || [],
            used_tool: state.used_tool || null,
            topMatchedProduct: state.topMatchedProduct,
            matchedProdInUserQues: state.matchedProdInUserQues,
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
            topMatchedProduct: result.cartProduct?.product || state.topMatchedProduct,
            matchedProdInUserQues: state.matchedProdInUserQues,
        };
    })

    // POLICY
    .addNode("policy", async (state) => {
        const result = await policyAgent({
            ...state,
            email: state.email,
            session_id: state.session_id,
            intent: state.next,
            answered_intents: state.answered_intents || []
        });

        return {
            ...state,
            messages: [...state.messages, ...(result.messages || [])],
            answered_intents: result.answered_intents || state.answered_intents || [],
            original_user_msg: state.original_user_msg,
            history: [...(state.history || []), ...(result.messages || [])],
            current_step: "intent",
        };
    })

    // SQL
    .addNode("sql", async (state) => {
        const result = await runSqlAgent(state.original_user_msg, state.email, state.session_id);

        return {
            messages: [...state.messages, ...(result.messages || [])],
            answered_intents: [
                ...(state.answered_intents || []),
                result.answered_intent // 👈 take from bridge
            ],
            original_user_msg: state.original_user_msg,
            history: [...(state.history || []), ...(result.messages || [])],
            current_step: "intent",
        };
    })

    .addNode("add_to_cart", addToCartNode)
    .addNode("match_product", matchProductNode)

    // CANCEL
    .addNode("cancel", async (state) => {
        return await cancelAgent({
            messages: state.messages,
            email: state.email,
            session_id: state.session_id, // ✅ THÊM DÒNG NÀY
            answered_intents: state.answered_intents || [],
            original_user_msg: state.original_user_msg,
        });
    })

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
        match_product: "match_product",
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
    .addConditionalEdges("add_to_cart", (s) => {
        if (!s.cartProduct || !s.cartProduct.product) {
            console.log("⚠️ add_to_cart: chưa có product, quay lại match_product");
            return "match_product";
        }
        return s.current_step || "__end__";
    }, {
        consult: "consult",
        intent: "intent",
        match_product: "match_product",
        __end__: "intent",
    })

    .addConditionalEdges("match_product", s => {
        console.log("🔄 Routing from match_product back to consult, step =", s.current_step);
        return s.current_step || "__end__";
    }, {
        consult: "consult",
        intent: "intent",
        __end__: "__end__"
    })


    .compile();
