// utils/llm.js
import { ChatOpenAI } from "@langchain/openai";

export const model = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-4o",
    temperature: 0.3,
});
