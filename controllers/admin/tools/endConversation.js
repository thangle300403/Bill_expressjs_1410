export const endConversation = {
    name: "endConversation",
    description: "End the conversation when no further actions are needed.",
    execute: async (_args, _state) => {
        return {
            role: "ai",
            content: "✅",
        };
    },
};