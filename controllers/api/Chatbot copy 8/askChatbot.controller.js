// askChatbot.controller.js
import { supervisorGraph } from "./supervisorGraph.js";
import { HumanMessage } from "@langchain/core/messages";
import jwt from "jsonwebtoken";
import chatbotModel from "../../../models/Chatbot.js";
import { saveChatHistory } from "./memory/saveChatHistory.js";

export const askChatbot = async (req, res) => {
    console.log("askChatbot controller");
    const token = req.cookies?.access_token;
    if (!token) return res.status(401).json({ error: "No access token provided" });

    console.log("Token trong chatbot controller", token);

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_KEY);
    } catch (err) {
        return res.status(403).json({ error: "Invalid or expired token" });
    }

    let email = decoded.email;
    console.log("Email trong chatbot controller", email);
    const userQuestion = req.body.question;

    await saveChatHistory({
        email,
        role: "user",
        content: userQuestion,
    });

    console.log("User Question:", userQuestion);

    const pastMessages = await chatbotModel.findByEmail(email);

    try {
        const result = await supervisorGraph.invoke({
            messages: [new HumanMessage(userQuestion)],
            original_user_msg: userQuestion,
            history: pastMessages,
            email,
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
