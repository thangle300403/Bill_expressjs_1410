// summarizeDescription.js
const OpenAI = require("openai");

// ⚙️ Khởi tạo client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Rút gọn mô tả sản phẩm cho embedding & chatbot.
 * @param {string} text - Mô tả gốc của sản phẩm
 * @returns {Promise<string>} - Mô tả đã rút gọn
 */
async function summarizeDescription(text) {
    if (!text || text.trim() === "") return "";

    const prompt = `
Rút gọn mô tả sản phẩm cầu lông thành 30–60 từ, chỉ giữ ý chính:
- Loại sản phẩm (vợt, giày, áo,...)
- Đối tượng sử dụng (người mới, trung cấp, chuyên nghiệp)
- Đặc điểm nổi bật (nặng đầu, nhẹ đầu, trợ lực,...)
- Công nghệ chính (nếu có)
- Mục đích sử dụng (tấn công, phòng thủ, toàn diện)
Bỏ qua câu quảng cáo hoặc lặp thương hiệu.

Mô tả gốc:
${text}
`;

    try {
        const res = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.5,
        });

        const shortText = res.choices[0].message.content.trim();
        console.log("🧠 Mô tả đã rút gọn:", shortText);

        return shortText;
    } catch (err) {
        console.error("❌ Lỗi khi rút gọn mô tả:", err);
        return text.slice(0, 200); // fallback: trả lại 200 ký tự đầu tiên
    }
}

module.exports = { summarizeDescription };
