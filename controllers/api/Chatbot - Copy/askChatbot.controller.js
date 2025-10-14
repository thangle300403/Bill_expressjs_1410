// askChatbot.controller.js
import { supervisorGraph } from "./graph.js";
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
            history: pastMessages,
            email,
        });

        const lastMsg = result.messages[result.messages.length - 1];
        res.json({ aiAnswer: lastMsg.content });
    } catch (err) {
        console.error("LangGraph Error:", err.message);
        res.status(500).json({ error: "Something went wrong with AI" });
    }
};
