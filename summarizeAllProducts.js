// summarizeAllProducts.js
require("dotenv").config();
const { summarizeDescription } = require("./controllers/admin/summarizeDescription");
const productModel = require("./models/Product");
const db = require("./models/db"); // kết nối MySQL

(async () => {
    try {
        console.log("🚀 Bắt đầu rút gọn mô tả các sản phẩm chưa có short_description...");

        // 1️⃣ Lấy toàn bộ sản phẩm chưa có short_description
        const [products] = await db.query(`
      SELECT id, name, description 
      FROM product 
      WHERE (short_description IS NULL OR short_description = '') 
        AND description IS NOT NULL 
      LIMIT 100;
    `);

        console.log(`📦 Tìm thấy ${products.length} sản phẩm cần xử lý.`);

        // 2️⃣ Duyệt từng sản phẩm
        for (const p of products) {
            console.log(`🧠 Đang rút gọn: ${p.name}`);

            const shortDesc = await summarizeDescription(p.description);
            if (!shortDesc) continue;

            await db.query(
                `UPDATE product SET short_description = ? WHERE id = ?`,
                [shortDesc, p.id]
            );

            console.log(`✅ Đã cập nhật: ${p.name}`);
            // delay nhẹ để tránh bị rate limit
            await new Promise((r) => setTimeout(r, 1500));
        }

        console.log("🎯 Hoàn tất cập nhật tất cả sản phẩm!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Lỗi:", err);
        process.exit(1);
    }
})();
