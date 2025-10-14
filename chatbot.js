import dotenv from "dotenv";
import { OpenAI } from "openai";

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function startChat() {
    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: "Hi! Can you help me pick a badminton racket?" },
        ],
    });

    console.log("🤖 GPT:", response.choices[0].message.content);
}

startChat();
