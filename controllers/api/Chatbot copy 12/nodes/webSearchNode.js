import "dotenv/config";
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function webSearchNode(state) {
    const query = state.original_user_msg || state.query;
    const location = state.location || {
        type: "approximate",
        country: "VN",
        city: "Ho Chi Minh",
        region: "Ho Chi Minh",
    };

    console.log("🌐 Executing webSearchNode with query:", query);

    try {
        const response = await openai.responses.create({
            model: "o4-mini",
            tools: [
                {
                    type: "web_search",
                    user_location: location,
                },
            ],
            input: query,
        });

        const answer = response.output_text || "❌ No output from web search";

        return {
            ...state,
            webSearchResult: answer,
            messages: [
                ...(state.messages || []),
                { role: "ai", content: `🌐 Kết quả web:\n\n${answer}` },
            ],
            current_step: "intent", // 👈 go back to intent
            used_tool: [...(state.used_tool || []), "web_search"],
        };
    } catch (err) {
        console.error("❌ webSearchNode error:", err);
        return {
            ...state,
            messages: [
                ...(state.messages || []),
                { role: "ai", content: `❌ Web search error: ${err.message}` },
            ],
            current_step: "intent", // 👈 even errors return to intent
        };
    }
}
