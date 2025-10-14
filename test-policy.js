// test-policy.js
import { policyAgent } from "./controllers/api/Chatbot/agents/policy.js";

(async () => {
    const messages = [
        { role: "user", content: "Chính sách hoàn tiền của shop là gì và giá vợt yonex astrox 100zz ?" }
    ];

    const result = await policyAgent({
        messages,
        email: "test@example.com",  // fake test email
        history: [],
        intent: "policy",
        answered_intents: [],
        original_user_msg: "Chính sách hoàn tiền của shop là gì và giá vợt yonex astrox 100zz ?"
    });

    console.log("✅ Policy Agent Output:", JSON.stringify(result, null, 2));
})();
