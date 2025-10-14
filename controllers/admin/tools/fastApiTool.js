import axios from "axios";
import { name } from "ejs";
import ChatMcpAdmin from "../../../models/ChatMcpAdmin.js";
import { encrypt } from "../../api/Chatbot/extra/encrypt.js";

export const fastApiTool = {
    name: "fastApiTool",
    description: `Send the raw user query to FastAPI for non-product admin operations like transport, customer, staff, etc.`,
    async execute(args, state) {
        try {

            const { email } = state.credentials;

            const baseUrl = process.env.FAST_API_SQLAGENT_ADMIN;
            if (!baseUrl) throw new Error("FAST_API_ADMIN not set");

            const res = await axios.post(`${baseUrl}/admin`, {
                query: args.query,
            });

            console.log("FastAPI tool response:", res.data);

            console.log("FastAPI sql candidate:", res.data.sql_candidate);

            const ans = res.data.answer || "✅ Done via FastAPI.";

            console.log("FastAPI tool result:", ans);

            await ChatMcpAdmin.saveChatMessage({ role: "ai", content: encrypt(ans), email });

            return { role: "ai", content: ans || "✅ Done via FastAPI.", sql_candidate: res.data.sql_candidate };
        } catch (err) {
            console.error("FastAPI tool error:", err.message);
            return { role: "ai", content: "❌ Lỗi khi gọi FastAPI." };
        }
    },
};
