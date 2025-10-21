// trainConsultDecision.js
import { addToVectorStore, getVectorStore } from "../vectorStore.js";
import dotenv from "dotenv";
dotenv.config();

const seedExamples = [
    // =====================
    // 🟦 CONSULT ONLY (no tools)
    // =====================
    {
        question: "Vợt nào phù hợp cho người mới chơi?",
        answer: "Cần tư vấn gợi ý sản phẩm, KHÔNG gọi tool.",
        type: "consult",
    },
    {
        question: "Mình cần vợt nhẹ đầu để dễ điều khiển, cổ tay yếu.",
        answer: "Tư vấn đặc điểm và gợi ý vợt phù hợp, KHÔNG gọi tool.",
        type: "consult",
    },
    {
        question: "Giày nào bám sân tốt để thi đấu trong nhà?",
        answer: "Tư vấn loại đế và mẫu giày, KHÔNG gọi tool.",
        type: "consult",
    },
    {
        question: "Áo cầu lông nào thấm hút mồ hôi tốt?",
        answer: "Tư vấn chất liệu và form áo, KHÔNG gọi tool.",
        type: "consult",
    },
    {
        question: "Phân biệt head-light và head-heavy thế nào?",
        answer: "Giải thích khái niệm, KHÔNG gọi tool.",
        type: "consult",
    },

    // =====================
    // 🟩 MATCH_PRODUCT
    // (người dùng nêu tên sản phẩm hoặc hãng, nhưng CHƯA nêu hành động mua/thêm)
    // =====================
    {
        question: "Giới thiệu cho tôi Yonex Astrox 100ZZ.",
        answer: "Tìm đúng sản phẩm trong dữ liệu → dùng tool match_product.",
        type: "match_product",
    },
    {
        question: "Áo cầu lông Lining bản mới nhất là gì?",
        answer: "Truy xuất sản phẩm mới nhất → dùng match_product.",
        type: "match_product",
    },
    {
        question: "Giày Yonex nào đang giảm giá?",
        answer: "Lọc theo hãng và giảm giá → dùng match_product.",
        type: "match_product",
    },
    {
        question: "Cho mình xem thông tin Yonex Duora Z Strike.",
        answer: "Tìm mô tả sản phẩm → dùng match_product.",
        type: "match_product",
    },
    {
        question: "Astrox 100ZZ có phiên bản màu khác không?",
        answer: "Truy xuất biến thể sản phẩm → dùng match_product.",
        type: "match_product",
    },

    // =====================
    // 🟨 ADD_TO_CART
    // (người dùng nói rõ hành động mua, thêm vào giỏ, hoặc đặt hàng)
    // =====================
    {
        question: "Thêm Yonex Duora Z Strike vào giỏ hàng.",
        answer: "Dùng match_product → add_to_cart.",
        type: "add_to_cart",
    },
    {
        question: "Mua Yonex Astrox 100ZZ.",
        answer: "Dùng match_product → add_to_cart.",
        type: "add_to_cart",
    },
    {
        question: "Đặt đôi giày Yonex Power Cushion.",
        answer: "Dùng match_product → add_to_cart.",
        type: "add_to_cart",
    },
    {
        question: "Thêm Astrox 77 Pro bản đỏ vào giỏ.",
        answer: "Dùng match_product → add_to_cart.",
        type: "add_to_cart",
    },
    {
        question: "Cho mình mua 1 cây Duora 10.",
        answer: "Dùng match_product → add_to_cart.",
        type: "add_to_cart",
    },
];

(async () => {
    await getVectorStore("consult_decision");

    console.log("📦 Seeding consult_decision_docs with consult decision examples...");

    for (const item of seedExamples) {
        await addToVectorStore(
            {
                question: item.question,
                answer: item.answer,
                email: "admin@seed.com",
                type: item.type,
            },
            "consult_decision"
        );
    }

    console.log("✅ Seeded Chroma with consult decision examples into 'consult_decision'");
})();
