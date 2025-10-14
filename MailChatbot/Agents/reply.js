// ai/agents/replyAgent.js
import { ChatOpenAI } from "@langchain/openai";
import { RunnableSequence } from "@langchain/core/runnables";
import { getRelevantDocs } from "../ragHelper.js";

export const replyAgent = async () => {
    const llm = new ChatOpenAI({ modelName: "gpt-4o", temperature: 0.5 });

    const chain = RunnableSequence.from([
        async (input) => {
            const context = await getRelevantDocs(input);
            return {
                messages: [
                    {
                        role: "system",
                        content: `You are a customer service agent. Use this internal knowledge when replying:\n\n${context}`,
                    },
                    {
                        role: "user",
                        content: `Draft a polite, helpful reply to the following customer message:\n\n${input}`,
                    },
                ],
            };
        },
        llm,
    ]);

    return chain;
};
