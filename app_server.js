import express from "express";
import { createMCPServer } from "langgraph-mcp";
import { match_product } from "./controllers/api/Chatbot/tools/match_product.mcp.js";

const app = express();
const mcp = createMCPServer();

mcp.registerTool(match_product);
app.use("/mcp", mcp.router);

app.listen(7001, () => console.log("🧠 MCP server running on port 7001"));
