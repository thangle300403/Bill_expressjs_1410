import { StateGraph } from "@langchain/langgraph";
import { cancelLLM } from "./cancelLLM.js";
import { checkInfo } from "./cancelTools/checkInfo.js";
import { confirmCancel } from "./cancelTools/confirmCancel.js";
import { executeCancel } from "./cancelTools/executeCancel.js";
import { z } from "zod";

const CancelState = z.object({
    messages: z.array(z.any()),
    email: z.string().optional(),        // session email (optional)
    temp_email: z.string().optional(),   // extracted from chat
    orderId: z.string().optional(),
    current_step: z.string().optional(),
    confirmed: z.boolean().optional(),
});

export const cancelPlannerGraph = new StateGraph(CancelState)
    .addNode("cancelLLM", cancelLLM)
    .addNode("CheckInfo", checkInfo)
    .addNode("ConfirmCancel", confirmCancel)
    .addNode("ExecuteCancel", executeCancel)

    .addEdge("__start__", "cancelLLM")

    .addConditionalEdges("cancelLLM", () => "CheckInfo")

    .addConditionalEdges("CheckInfo", (s) => {
        if (s.current_step === "cancelLLM") return "cancelLLM";
        if (s.current_step === "ConfirmCancel") return "ConfirmCancel";
        return "__wait_user_input__";
    }, {
        cancelLLM: "cancelLLM",
        ConfirmCancel: "ConfirmCancel",
        __wait_user_input__: "__end__",
    })

    .addConditionalEdges("ConfirmCancel", (s) => {
        if (s.confirmed) return "ExecuteCancel";
        return "__end__";
    })

    .addEdge("ExecuteCancel", "__end__")

    .compile();
