// trainConsultDecision.js
import dotenv from "dotenv";
import { addToVectorStore, getVectorStore } from "../vectorStore.js";
dotenv.config();

const seedExamples = [
    // =====================
    // 🟩 MATCH_PRODUCT
    // (user mentions product or brand, wants info but not yet adding)
    // =====================
    {
        question: "Giới thiệu cho tôi Yonex Astrox 100ZZ.",
        answer: "Truy xuất mô tả và thông tin sản phẩm → dùng tool match_product.",
        type: "match_product",
    },
    {
        question: "Áo cầu lông Lining bản mới nhất là gì?",
        answer: "Tìm sản phẩm mới nhất của hãng → dùng match_product.",
        type: "match_product",
    },
    {
        question: "Giày Yonex nào đang giảm giá?",
        answer: "Lọc danh sách sản phẩm giảm giá → dùng match_product.",
        type: "match_product",
    },
    {
        question: "Cho mình xem thông tin Yonex Duora Z Strike.",
        answer: "Tìm thông tin chi tiết → dùng match_product.",
        type: "match_product",
    },
    {
        question: "Astrox 100ZZ có màu khác không?",
        answer: "Truy xuất biến thể sản phẩm → dùng match_product.",
        type: "match_product",
    },
    {
        question: "Mẫu giày Power Cushion Eclipsion có bản mới không?",
        answer: "Tìm phiên bản mới của sản phẩm → dùng match_product.",
        type: "match_product",
    },
    {
        question: "Áo Yonex 103EX có sẵn size L không?",
        answer: "Tra cứu sản phẩm cụ thể → dùng match_product.",
        type: "match_product",
    },

    // =====================
    // 🟨 ADD_TO_CART
    // (user expresses intent to buy, add to cart, or order)
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
    {
        question: "Mình muốn đặt áo Yonex 2025 bản mới.",
        answer: "Tìm sản phẩm → add_to_cart.",
        type: "add_to_cart",
    },
    {
        question: "Mua ngay đôi giày Lining AYAS010.",
        answer: "Dùng match_product → add_to_cart.",
        type: "add_to_cart",
    },
];

(async () => {
    await getVectorStore("tools");

    console.log("📦 Seeding  with match_product + add_to_cart examples...");

    for (const item of seedExamples) {
        await addToVectorStore(
            {
                question: item.question,
                answer: item.answer,
                email: "admin@seed.com",
                type: item.type,
            },
            "tools"
        );
    }

    console.log("✅ Seeded Chroma  examples (only match_product + add_to_cart)");
})();
