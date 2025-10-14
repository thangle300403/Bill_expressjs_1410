import dotenv from "dotenv";
dotenv.config();

import { consultChain } from "./controllers/api/Chatbot/agents/consult.js";
import { addToCartTool } from "./controllers/api/Chatbot/tools/addToCartTool.js";

// 🧪 Simulate user asking to buy a specific product
const testMessages = [
    { role: "user", content: "Tôi muốn mua cây vợt Lining Aeronant 9000d." }
];

// 🧪 Simulate your product list (should match what's in the DB ideally)
const productList = [
    {
        id: 1,
        name: "Lining Aeronant 9000d",
        sale_price: 3900000,
        quantity: 1,
        imageUrl: "http://localhost:3069/images/lining.jpg",
        productUrl: "http://localhost:3069/san-pham/lining-aeronant-9000d-1"
    },
    {
        id: 2,
        name: "Yonex Duora 10",
        sale_price: 3400000,
        quantity: 1,
        imageUrl: "http://localhost:3069/images/duora.jpg",
        productUrl: "http://localhost:3069/san-pham/yonex-duora-10-2"
    }
];

// 🧪 Fake memory of chat history to help the AI
const historyFormatted = `
KH: vợt cho người mới chơi
AI: Bạn có thể chọn Yonex Duora 10 hoặc Lining Aeronant 9000d. Bạn có muốn thêm vào giỏ hàng không ?
KH: Tôi thích cây Lining.
`;

const context = ""; // optional

// 🚀 Run test
const run = async () => {
    try {
        const result = await consultChain.invoke({
            messages: testMessages,
            productList,
            historyFormatted,
            context
        });

        console.log("🧠 Full AI response:");
        console.dir(result, { depth: null });

        if (result.tool_calls?.length > 0) {
            for (const toolCall of result.tool_calls) {
                console.log("✅ Tool called:", toolCall.name);
                console.log("🔧 Args:", toolCall.args);
            }
        } else {
            console.log("❌ No tool invoked.");
        }
    } catch (err) {
        console.error("❌ Error running consult test:", err.message);
    }
};

run();
