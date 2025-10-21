const chatbotModel = require('../../models/Chatbot');
const jwt = require('jsonwebtoken');
const OpenAI = require('openai');
const { findProductMatches } = require('./Chatbot/extra/findProductMatches');
const productModel = require('../../models/Product');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const ApiChatbotController = {
    chatHistory: async (req, res) => {
        try {
            const token = req.cookies.access_token;
            const session_id = req.cookies.chatbot_session || null;

            let email = null;
            if (token) {
                try {
                    const decoded = jwt.verify(token, process.env.JWT_KEY);
                    email = decoded.email;
                } catch (err) {
                    console.log("Invalid token, fallback to session_id only");
                }
            }

            if (!email && !session_id) {
                return res.status(400).json({ message: 'Không có email hoặc session_id để truy xuất lịch sử' });
            }

            const chatHistory = await chatbotModel.findByEmailOrSessionFE(email, session_id);

            res.json(chatHistory);
        } catch (error) {
            console.error('History error:', error.message);
            res.status(500).send(error.message);
        }
    },

    mergeSessionToEmail: async (req, res) => {
        try {
            console.log("🟢 [mergeSessionToEmail] Called");

            const token = req.cookies.access_token;
            const session_id = req.cookies.chatbot_session || null;

            console.log("🔹 Cookies received:", {
                access_token_exists: !!token,
                session_id,
            });

            if (!token || !session_id) {
                console.warn("⚠️ Missing token or session_id");
                return res.status(400).json({ message: "Token hoặc session_id bị thiếu" });
            }

            // ✅ Decode token
            let decoded;
            try {
                decoded = jwt.verify(token, process.env.JWT_KEY);
                console.log("🔹 Decoded token:", decoded);
            } catch (err) {
                console.error("❌ JWT verify failed:", err.message);
                return res.status(401).json({ message: "Token không hợp lệ" });
            }

            const email = decoded.email;
            console.log("🔹 Extracted email:", email);

            // ✅ Try merging session
            const [result] = await chatbotModel.mergeSessionToEmail(email, session_id);

            console.log("🔹 SQL Result:", result);

            // Check if update happened
            if (result.affectedRows > 0) {
                console.log(`✅ Session merged for email=${email}, session_id=${session_id}`);
                res.json({ message: "Merge thành công", affectedRows: result.affectedRows });
            } else {
                console.warn(
                    `⚠️ No rows updated. Possibly session not found or already merged. email=${email}, session_id=${session_id}`
                );
                res.json({
                    message: "Không có dữ liệu để merge (có thể đã merge trước đó)",
                    affectedRows: 0,
                });
            }
        } catch (error) {
            console.error("🔥 [mergeSessionToEmail] Merge error:", error);
            res.status(500).send(error.message);
        }
    },


    searchWeb: async (req, res) => {
        const { query } = req.body;

        if (!query) {
            return res
                .status(400)
                .json({ aiMessages: [{ role: "ai", content: "❌ No query provided" }] });
        }

        try {
            const products = await productModel.getAll();
            const response = await openai.responses.create({
                model: "o4-mini",
                tools: [
                    {
                        type: "web_search",
                        user_location: {
                            type: "approximate",
                            country: "VN",
                            city: "Ho Chi Minh",
                            region: "Ho Chi Minh",
                        },
                    },
                ],
                input: query,
            });

            const answer = response.output_text || "❌ No output from web search";

            console.log("answer");

            const { matched, productDetailUrls } = findProductMatches(answer, products);

            console.log("HTML cards:", productDetailUrls);

            return res.json({
                aiMessages: [{ role: "ai", content: `🌐 Kết quả web:\n\n${answer}` + productDetailUrls }],
            });
        } catch (err) {
            console.error("❌ Websearch error:", err);
            return res.status(500).json({
                aiMessages: [
                    { role: "ai", content: `❌ Websearch error: ${err.message}` },
                ],
            });
        }
    }
};

module.exports = ApiChatbotController;
