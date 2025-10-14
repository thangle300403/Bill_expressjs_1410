import { intentClassifier } from "./controllers/api/Chatbot/agents/classifier.js"; // adjust path if needed
import { HumanMessage } from "@langchain/core/messages";

const test = async () => {
    const question = "  giá vợt cầu lông yonex astrox 99 pro và chính sách đổi trả là gì ??";

    const result = await intentClassifier({
        messages: [new HumanMessage(question)],
        email: "test@example.com", // dummy email
        answered_intents: ["sql"],      // simulate initial state
        original_user_msg: question
    });

    console.log("🧠 Classifier Result:");
    console.log("🔸 next intent:", result.next);
    console.log("📝 answered_intents:", result.answered_intents);
    console.log("📤 original_user_msg:", result.original_user_msg);
};

test().catch(console.error);
