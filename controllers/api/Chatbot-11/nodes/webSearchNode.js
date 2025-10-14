import { pushLog } from "../extra/sseLogs.js";

export async function webSearchNode(state) {
    console.log("🌐 Web Search Node is being executed");
    const { email, session_id, original_user_msg } = state;

    const logKey = email || session_id;
    const log = (msg, step = null) => pushLog(logKey, { msg, step });

    const query = original_user_msg || state.messages.at(-1)?.content || "sản phẩm mới";

    log(`🔍 Đang tìm kiếm trên web: "${query}"`, "web-search");

    // Dùng DuckDuckGo hoặc API bạn muốn
    const searchRes = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`);
    const json = await searchRes.json();

    let result =
        json?.Abstract?.trim() ||
        json?.Answer?.trim() ||
        (Array.isArray(json?.RelatedTopics) && json.RelatedTopics.length > 0
            ? json.RelatedTopics[0]?.Text || json.RelatedTopics[0]?.Name
            : null); console.log("🔎 Web Search Result:", result);

    log(`🔎 Kết quả tìm kiếm: ${result}`, "web-search-result");
    console.log("🌐 Raw WebSearch JSON:", JSON.stringify(json, null, 2));


    const prevUsed = Array.isArray(state.used_tool)
        ? state.used_tool
        : state.used_tool
            ? [state.used_tool]
            : [];

    const newUsedTools = [...new Set([...prevUsed, "web_search"])];

    return {
        ...state,
        messages: [
            ...state.messages,
            {
                role: "ai",
                content: `🔍 Đây là kết quả tìm kiếm trên web:\n\n${result}`,
                additional_kwargs: { tag: "web_search_result" },
            },
        ],
        toolOutput: {
            role: "ai",
            action: "web_search",
            result,
        },
        current_step: "consult",
        used_tool: newUsedTools,
    };
}
