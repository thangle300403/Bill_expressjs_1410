// trainPolicyText.js
import { addToVectorStore, getVectorStore } from "../vectorStore.js";
import dotenv from "dotenv";
dotenv.config();

const seedExamples = [
    {
        question: "Chính sách đổi trả như thế nào?",
        answer:
            "Bạn có thể đổi sản phẩm trong vòng 7 ngày (HCM) hoặc 14 ngày (tỉnh) nếu sản phẩm bị lỗi hoặc không đúng mô tả.",
        type: "policy",
    },
    {
        question: "Tôi muốn đổi sản phẩm do bị lỗi thì làm sao?",
        answer:
            "Bạn có thể mang sản phẩm đến cửa hàng hoặc gửi qua bưu điện kèm theo hoá đơn để được hỗ trợ đổi trả.",
        type: "policy",
    },
    {
        question: "Cách tính phí vận chuyển như thế nào?",
        answer:
            "Phí giao hàng tại TP.HCM cố định 15.000đ. Ở tỉnh sẽ tính theo khoảng cách và đơn vị vận chuyển.",
        type: "policy",
    },
    {
        question: "Tôi có được hoàn tiền không?",
        answer:
            "Nếu sản phẩm lỗi không thể đổi được, bạn sẽ được hoàn lại toàn bộ số tiền trong 3-5 ngày làm việc.",
        type: "policy",
    },
    {
        question: "Cửa hàng có xuất hóa đơn đỏ không?",
        answer: "Có, bạn có thể yêu cầu xuất hóa đơn GTGT sau khi thanh toán.",
        type: "policy",
    },
    {
        question: "Tôi có thể thanh toán khi nhận hàng không?",
        answer: "Dĩ nhiên! Bạn có thể chọn hình thức thanh toán COD khi đặt hàng.",
        type: "policy",
    },
    {
        question: "Chính sách bảo mật thông tin khách hàng như thế nào?",
        answer:
            "Thông tin khách hàng được bảo mật tuyệt đối và chỉ sử dụng cho mục đích xử lý đơn hàng.",
        type: "policy",
    },
];

(async () => {
    await getVectorStore("policy_docs");

    console.log("📦 Seeding policy_docs with curated policy Q&A");

    for (const item of seedExamples) {
        await addToVectorStore(
            {
                question: item.question,
                answer: item.answer,
                email: "admin@seed.com", // hoặc null
                type: item.type,
            },
            "policy_docs"
        );
    }

    console.log("✅ Seeded Chroma with curated policy questions into 'policy_docs'");
})();
