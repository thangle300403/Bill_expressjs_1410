import { pipeline } from '@xenova/transformers';

const classifier = await pipeline(
    'text-classification',
    'nlptown/bert-base-multilingual-uncased-sentiment'
);

// Mapping from label to sentiment
const starsToSentiment = {
    '1 star': 'negative',
    '2 stars': 'negative',
    '3 stars': 'neutral',
    '4 stars': 'positive',
    '5 stars': 'positive'
};

// Test comments
const comments = [
    "Sản phẩm rất tốt, tôi hài lòng.",
    "Thái độ phục vụ kém, giao hàng trễ.",
    "Không có gì đặc biệt, tạm ổn.",
    "Tôi cực kỳ thất vọng về chất lượng.",
    "Shop phản hồi nhanh, giá rẻ hợp lý."
];

for (const text of comments) {
    try {
        const result = await classifier(text);
        const label = result[0]?.label ?? "unknown";
        const score = (result[0]?.score * 100).toFixed(2) ?? "0.00";
        const sentiment = starsToSentiment[label] || "unknown";

        console.log(`📝 "${text}" → ${label} (${score}%) → 🧠 ${sentiment}`);
    } catch (err) {
        console.error(`❌ Error on "${text}":`, err.message);
    }
}
