import axios from "axios";
import dotenv from "dotenv";
import { findProductMatches } from "../extra/findProductMatches.js";
import { getProductCache } from "../cache/productCache.js";
dotenv.config();

export async function runSqlAgent(query, email) {
    try {
        const res = await axios.post(`${process.env.FAST_API_SQLAGENT}/sql`,
            {
                query,
                email,
            });

        let aiText = res.data.answer || "";
        let productCards = "";

        // 🔍 Load product list from DB and try to match
        const products = await getProductCache();
        const { matched, productDetailUrls } = findProductMatches(aiText, products);

        if (matched.length > 0) {
            productCards = productDetailUrls;
        }

        return {
            messages: [{ role: "ai", content: aiText + productCards }],
            answered_intent: "sql",
        };
    } catch (err) {
        console.error("SQL Agent API error:", err.message);
        return {
            messages: [{ role: "ai", content: "❌ Lỗi khi truy vấn SQL agent." }],
            answered_intent: "sql",
        };
    }
}
