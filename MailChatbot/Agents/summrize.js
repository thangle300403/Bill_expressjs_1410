// ai/agents/summarizerAgent.js
import { ChatOpenAI } from "@langchain/openai";
import { RunnableSequence } from "@langchain/core/runnables";
import { getRelevantDocs } from "../ragHelper.js";

export const summarizerAgent = async () => {
    const llm = new ChatOpenAI({ modelName: "gpt-4o", temperature: 0 });

    const chain = RunnableSequence.from([
        async (input) => {
            const context = await getRelevantDocs(input);
            return {
                messages: [
                    {
                        role: "system",
                        content: `You are a support assistant. Use the following context from internal policy to improve your summary:\n\n${context}`,
                    },
                    {
                        role: "user",
                        content: `Summarize this customer's message:\n\n${input}`,
                    },
                ],
            };
        },
        llm,
    ]);

    return chain;
};
