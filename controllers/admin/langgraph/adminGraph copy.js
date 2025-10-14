import { StateGraph, END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { availableTools } from "../tools/index.js";
import { START } from "@langchain/langgraph";
import fs from "fs";
import path from "path";
import productModel from "../../../models/Product.js";
import ChatMcpAdmin from "../../../models/ChatMcpAdmin.js";


const llm = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0.3 });

const editDom = fs.readFileSync(
    path.resolve("controllers/admin/tools/pages/editProduct.txt"),
    "utf8"
);

// Step 1: LLM decides which tool to use
async function decideTool(state) {
    console.log("🚧 Executing: decideTool");

    const email = state.credentials?.email;

    const historyLogs = await ChatMcpAdmin.findByEmail(email);

    // Map to messages for LangGraph
    const pastMessages = historyLogs.map(log => ({
        role: log.role,
        content: log.content,
        timestamp: log.timestamp,
    }));

    const latestUserMessage = [...pastMessages].reverse().find(msg => msg.role === "user");

    const relatedAiMessages = pastMessages.filter(msg =>
        msg.role === "ai" &&
        msg.timestamp > latestUserMessage.timestamp
    );

    const toolList = Object.entries(availableTools).map(([name, tool]) => ({
        name,
        description: tool.description || "(No description)"
    }));

    const allProduct = await productModel.getAllNamesAndIds();

    const systemPrompt = `
You are an **admin editting assistant bot**. 

Your job is to read the user's latest message and decide what TOOL should be used to respond, or whether the task is already complete.

Here is the latest user request:
"${latestUserMessage?.content}"

Here are the related AI responses to the latest user request (this is to check the job is done or not),
${JSON.stringify(relatedAiMessages)}

- If the latest user message includes multiple products or fields,
  return tools one at a time (e.g., update 100zz first, then 88d),
  if u find the number of products is done, use tool name "endConversation", avoid the infinite loop.

==DATA==
- allProducts: ${JSON.stringify(allProduct)}
- Edit DOM: ${editDom} read this carefully, because sometimes user question is not about just product.
- You have access to these tools:${toolList.join("\n")} (tool puppeteerEditOrderStatus is designed for orders only)

Rules:
1. Always return JSON only, no explanation.
2. The JSON format must be:
{ "tool": "<toolName>" , "args": { ... }, "end": false }

3. If the request is about:
   - "mở admin", "open admin", "vào trang admin" → use **openAdmin**
   - "sửa sản phẩm …", "chỉnh …" →  once you have the name, use **puppeteerFillForm** with selector + liHtml + value

4. To find liHtml:
- Use the "Edit DOM" content to locate the correct <li> block for the admin sidebar.
- Look for <li> that contains an <a> tag linking to the right page (e.g., /admin for product).
- Include the full <li> HTML.

5. Riêng câu hỏi liên quan đến đơn hàng thì searchParam là id của đơn hàng.

LƯU Ý:
 tool puppeteerFillForm thì có dạng như sau (chỉ là ví dụ):
{ "tool": "puppeteerFillForm", "args": {
   "searchParam": "Yonex Astrox 100zz",
   "selector": "input[name='discount_percentage']",
  "liHtml": "<li class=\"nav-item\">\n  <a href=\"/admin\" class=\"nav-link\">\n    <i class=\"nav-icon fas fa-box\"></i>\n    <p>Quản lý Sản phẩm</p>\n  </a>\n</li>",
   "value": "9"
 }}

 tool puppeteerEditOrderStatus thì có dạng như sau (chỉ là ví dụ):
 {
  "tool": "puppeteerEditOrderStatus",
  "args": {
    "searchParam": "12",
    "newStatusId": "2",
    "liHtml": "<li class=\"nav-item\">\n  <a href=\"/admin/order\" class=\"nav-link\">\n    <i class=\"nav-icon fas fa-shopping-cart\"></i>\n    <p>Quản lý Đơn hàng</p>\n  </a>\n</li>"
  }
}
`;


    const prompt = [
        { role: "system", content: systemPrompt },
        ...state.messages,
    ];

    const result = await llm.invoke(prompt);

    try {
        const toolCall = JSON.parse(result.content.trim());

        console.log("🚧 Tool call:", toolCall);
        return { ...state, toolCall };
    } catch (err) {
        return {
            ...state,
            toolCall: { tool: null, args: {} },
            messages: [
                { role: "ai", content: "⚠️ I couldn't understand what tool to use." }
            ]
        };
    }
}

// Step 2: Execute the chosen tool
async function runTool(state) {
    const { tool, args } = state.toolCall;
    if (!tool || !availableTools[tool]) {
        return {
            ...state,
            messages: [{ role: "ai", content: "❌ No valid tool chosen." }]
        };
    }

    const result = await availableTools[tool].execute(args || {}, {
        ...state,
        credentials: state.credentials
    });

    return {
        ...state,
        messages: [result]
    };
}

const graph = new StateGraph({
    channels: {
        messages: {
            type: "list",
            initialValueFactory: () => [],
        },
        toolCall: {
            type: "map",
            initialValueFactory: () => ({}),
        },
        credentials: {
            type: "map",
            initialValueFactory: () => ({ email: null, password: null }),
        },
    },
});

graph.addNode("decideTool", decideTool);
graph.addNode("runTool", runTool);

graph.addEdge(START, "decideTool");

graph.addConditionalEdges("decideTool", (state) => {
    return state.toolCall?.tool ? "runTool" : END;
});

graph.addConditionalEdges("runTool", (state) => {
    if (state.toolCall?.tool === "endConversation") return END;
    return "decideTool";
});
export const adminGraph = graph.compile();
