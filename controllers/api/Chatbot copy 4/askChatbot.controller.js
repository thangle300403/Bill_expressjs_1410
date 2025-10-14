// askChatbot.controller.js
import { supervisorGraph } from "./supervisorGraph.js";
import { HumanMessage } from "@langchain/core/messages";
import jwt from "jsonwebtoken";
import chatbotModel from "../../../models/Chatbot.js";

export const askChatbot = async (req, res) => {
    const token = req.cookies.access_token;

    // const token = req.headers.authorization?.split(" ")[1];
    // console.log(token);
    // const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTA0LCJlbWFpbCI6InRoYW5nbGUzMDA0MDNAZ21haWwuY29tIiwibmFtZSI6IlRo4bqvbmcgTMOqIiwiaWF0IjoxNzUyNTQ2MTQzLCJleHAiOjE3NTUxMzgxNDN9.T926_dPF2_jF20s5ix-PIaUYYjSABiaAdMYV3iNNYHY";

    if (!token) return res.status(401).json({ message: "No token provided" });

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_KEY);
    } catch {
        return res.status(401).json({ message: "Invalid token" });
    }

    let email = decoded.email;
    const userQuestion = req.body.question;

    console.log("User Question:", userQuestion);

    const pastMessages = await chatbotModel.findByEmail(email);

    try {
        const result = await supervisorGraph.invoke({
            messages: [new HumanMessage(userQuestion)],
            original_user_msg: userQuestion,
            history: pastMessages,
            email,
        });

        console.log("cartOutput:", result.cartOutput);

        const aiMessages = result.messages.filter(m => m.role === "ai");

        const seen = new Set();
        const dedupedMessages = aiMessages.filter(m => {
            if (seen.has(m.content)) return false;
            seen.add(m.content);
            return true;
        });

        const combinedResponse = dedupedMessages
            .map((m, i) => `🤖 ${i + 1}. ${m.content}`)
            .join("\n\n");

        res.json({ aiAnswer: combinedResponse, cartOutput: result.cartOutput });

    } catch (err) {
        console.error("LangGraph Error:", err.message);
        res.status(500).json({ error: "Something went wrong with AI" });
    }
};
