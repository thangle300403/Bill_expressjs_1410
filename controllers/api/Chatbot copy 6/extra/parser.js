// chatbot/extra/parser.js

export function extractSQL(text) {
    const match = text.match(/```sql\s*([\s\S]*?)```/i);
    return match ? match[1].trim() : null;
}

export function extractMessageText(text) {
    const match = text.match(/\{message:\s*["']([^"']+)["']\s*\}/);
    return match ? match[1].trim() : "";
}

export function extractTextBeforeSQL(text) {
    // Tìm vị trí bắt đầu của block ```sql
    const index = text.search(/```sql/i);
    if (index === -1) {
        return text.trim(); // Không có SQL, trả về toàn bộ text
    }
    // Trả về phần trước block ```sql
    return text.slice(0, index).trim();
}
