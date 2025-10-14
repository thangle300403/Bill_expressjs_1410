// askChatbot.controller.js
import { supervisorGraph } from "./supervisorGraph.js";
import { HumanMessage } from "@langchain/core/messages";
import jwt from "jsonwebtoken";
import chatbotModel from "../../../models/Chatbot.js";
import { saveChatHistory } from "./memory/saveChatHistory.js";
import openai from "openai";
import productModel from "../../../models/Product.js";
import { getProductCache } from "./cache/productCache.js";


export const askChatbot = async (req, res) => {
    const token = req.cookies?.access_token;
    const session_id = req.cookies?.chatbot_session || null;

    let email = null;
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_KEY);
            email = decoded.email;
        } catch (err) {
            console.log("Invalid or expired token:", err.message);
        }
    }

    const userQuestion = req.body.question;

    await saveChatHistory({
        email,
        session_id,
        role: "user",
        content: userQuestion,
    });

    console.log("User Question:", userQuestion);

    const pastMessages = await chatbotModel.findByEmailOrSession(email, session_id);
    try {
        const result = await supervisorGraph.invoke({
            messages: [new HumanMessage(userQuestion)],
            original_user_msg: userQuestion,
            history: pastMessages,
            session_id,
            email: email ?? "",
        });

        // 🔸 Deduplicate messages by role + content
        const seen = new Set();
        const dedupedMessages = result.messages.filter((m) => {
            const key = `${m.role}-${m.content}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // 🔹 Save only deduplicated user/ai messages
        for (const msg of dedupedMessages) {
            if (msg.role === "user" || msg.role === "ai") {
                await saveChatHistory({
                    email,
                    session_id,
                    role: msg.role,
                    content: msg.content,
                });
            }
        }

        console.log("Answered Intents:", result.answered_intents);
        const aiMessages = dedupedMessages.filter((m) => m.role === "ai");
        const combinedResponse = aiMessages
            .map((m, i) => `🤖 ${i + 1}. ${m.content}`)
            .join("\n\n");

        res.json({
            aiAnswer: combinedResponse,
            cartOutput: result.cartOutput,
            aiMessages,
        });
    } catch (err) {
        console.error("LangGraph Error:", err.message);
        res.status(500).json({ error: "Something went wrong with AI" });
    }
};

export const searchWeb = async (req, res) => {
    const { query } = req.body;

    if (!query) {
        return res
            .status(400)
            .json({ aiMessages: [{ role: "ai", content: "❌ No query provided" }] });
    }

    try {
        const products = await getProductCache();

        const response = await openai.responses.create({
            model: "o4-mini",
            tools: [
                {
                    type: "web_search",
                    user_location: {
                        type: "approximate",
                        country: "VN",
                        city: "Ho Chi Minh",
                        region: "Ho Chi Minh",
                    },
                },
            ],
            input: query,
        });

        const answer = response.output_text || "❌ No output from web search";

        const { matched, productDetailUrls } = findProductMatches(aiText, products);

        console.log("Matched:", matched);
        console.log("HTML cards:", productDetailUrls);

        return res.json({
            aiMessages: [{ role: "ai", content: `🌐 Kết quả web:\n\n${answer}` + productDetailUrls }],
        });
    } catch (err) {
        console.error("❌ Websearch error:", err);
        return res.status(500).json({
            aiMessages: [
                { role: "ai", content: `❌ Websearch error: ${err.message}` },
            ],
        });
    }
}
