// seedChromaSQLExamples.js
import { addToVectorStore, getVectorStore } from "./vectorStore.js";
import dotenv from "dotenv";
dotenv.config();

const seedExamples = [
    // 🛒 Orders
    {
        question: "Tôi muốn xem đơn hàng gần nhất của mình.",
        answer: "Dưới đây là đơn hàng gần nhất của bạn cùng thông tin sản phẩm và trạng thái.",
        type: "sql",
    },
    {
        question: "Làm sao để xem lịch sử mua hàng?",
        answer: "Bạn có thể xem tất cả đơn hàng đã đặt tại mục 'Đơn hàng của tôi'.",
        type: "sql",
    },

    // 🔥 Promotions
    {
        question: "Những sản phẩm nào đang giảm giá?",
        answer: "Danh sách sản phẩm đang được khuyến mãi sẽ được hiển thị kèm theo phần trăm giảm giá.",
        type: "sql",
    },
    {
        question: "Tôi muốn biết có sản phẩm nào giảm trên 20% không?",
        answer: "Dưới đây là các sản phẩm có mức giảm giá từ 20% trở lên.",
        type: "sql",
    },

    // 🎯 Search by name or category
    {
        question: "Tôi muốn tìm sản phẩm Yonex Astrox 88D Pro.",
        answer: "Đây là thông tin chi tiết của Yonex Astrox 88D Pro bạn yêu cầu.",
        type: "sql",
    },
    {
        question: "Có sản phẩm nào thuộc dòng Lining không?",
        answer: "Dưới đây là tất cả sản phẩm thuộc thương hiệu Lining.",
        type: "sql",
    },

    // 💰 Price filter
    {
        question: "Tôi muốn xem vợt cầu lông giá dưới 2 triệu.",
        answer: "Đây là những cây vợt có mức giá dưới 2.000.000đ.",
        type: "sql",
    },
    {
        question: "Làm sao xem các đơn hàng đã hủy của tôi?",
        answer: "Bạn có thể xem danh sách đơn hàng bị hủy tại mục 'Đơn hàng của tôi' bằng cách lọc theo trạng thái 'Đã hủy'.",
        type: "sql"
    },
    {
        question: "Liệt kê các đơn hàng đã bị hủy?",
        answer: "Dưới đây là các đơn hàng có trạng thái 'Đã hủy' trong tài khoản của bạn.",
        type: "sql"
    },
    {
        question: "Có bao nhiêu đơn hàng tôi đã hủy?",
        answer: "Chúng tôi đã thống kê số lượng đơn hàng có trạng thái 'Đã hủy' của bạn như sau.",
        type: "sql"
    }

];

(async () => {
    // Ensure the correct vector store is initialized
    await getVectorStore("sql_docs");

    console.log("... Seededing Chroma with curated sql examples into 'sql_docs'.");

    for (const item of seedExamples) {
        await addToVectorStore({
            question: item.question,
            answer: item.answer,
            email: "admin@seed.com",
            type: item.type,
        }, "sql_docs");
    }

    console.log("✅ Seeded Chroma with acurated sql examples into 'sql_docs'.");
})();