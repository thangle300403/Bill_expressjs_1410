// ai/emailGraph.js
import { StateGraph } from "@langchain/langgraph";
import { summarizerAgent } from "./agents/summarizerAgent.js";
import { replyAgent } from "./agents/replyAgent.js";

// Build LangGraph
const builder = new StateGraph();

// Register nodes
builder.addNode("summarize", await summarizerAgent());
builder.addNode("reply", await replyAgent());

// Router logic
builder.setEntryPoint("router");
builder.addNode("router", async (state) => {
    if (state.actionType === "summarize") return { next: "summarize" };
    if (state.actionType === "reply") return { next: "reply" };
    return { next: "__end__" };
});

// End the graph after either path
builder.addEdge("summarize", "__end__");
builder.addEdge("reply", "__end__");

export const emailGraph = builder.compile();
