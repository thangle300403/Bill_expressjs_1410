import { addToVectorStore, getVectorStore } from "./vectorStore.js";
import dotenv from "dotenv";
dotenv.config();

const seedExamples = [
    {
        question: "Vợt cầu lông nào phù hợp cho người mới chơi?",
        answer: "Bạn nên chọn các dòng vợt nhẹ, linh hoạt như Yonex Nanoray hoặc Lining Turbo để dễ điều khiển.",
        type: "consult",
    },
    {
        question: "Tôi cần một cây vợt có lực đập mạnh, nên chọn loại nào?",
        answer: "Yonex Astrox 88D Pro hoặc Victor Thruster K là những lựa chọn nổi bật cho lối đánh tấn công.",
        type: "consult",
    },
    {
        question: "Giày cầu lông nào phù hợp cho người mới chơi?",
        answer: "Giày Yonex SHB 65Z3 hoặc Lining Ultra III có giá mềm và độ êm tốt cho người mới.",
        type: "consult",
    },
    {
        question: "Cần giày chống trượt tốt cho sân trong nhà?",
        answer: "Bạn có thể chọn Asics Gel Blade hoặc Mizuno Wave Fang vì có đế bám tốt.",
        type: "consult",
    },
    {
        question: "Tôi muốn chọn áo cầu lông thoáng mát cho mùa hè?",
        answer: "Áo Victor Dri-Fit và Yonex Cool Dry là hai dòng thoáng khí, nhẹ và thấm hút tốt.",
        type: "consult",
    },
    {
        question: "Grip nào bám tay tốt cho người hay ra mồ hôi tay?",
        answer: "Bạn có thể dùng grip Yonex Super Grap hoặc Lining GP21 có độ bám tốt và hút ẩm.",
        type: "consult",
    },
    {
        question: "Vợt nào có lực đập tốt cho smash mạnh?",
        answer: "Bạn nên chọn Yonex Astrox 99 hoặc Victor TK-F vì cả hai đều hỗ trợ smash uy lực.",
        type: "consult",
    },
    {
        question: "Vợt nào đánh cầu mạnh và nặng đầu?",
        answer: "Astrox 88D Pro là lựa chọn tốt cho người chơi thiên về sức mạnh và smash.",
        type: "consult",
    },
    {
        question: "Em cần vợt đánh mạnh tay, smash nổ?",
        answer: "Bạn nên thử Lining Turbo Charging 75 hoặc Astrox 77 — cả hai hỗ trợ smash rất tốt.",
        type: "consult",
    }
];

(async () => {
    // Ensure the correct vector store is initialized
    await getVectorStore("consult_docs");

    console.log("... Seededing Chroma with curated consult examples into 'consult_docs'.");

    for (const item of seedExamples) {
        await addToVectorStore({
            question: item.question,
            answer: item.answer,
            email: "admin@seed.com",
            type: item.type,
        }, "consult_docs");
    }

    console.log("✅ Seeded Chroma with acurated consult examples into 'consult_docs'.");
})();
