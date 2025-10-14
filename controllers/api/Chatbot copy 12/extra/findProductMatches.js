import slugify from "slugify";

export function findProductMatches(aiText, products) {
    const matched = [];
    const seenNames = new Set();

    // match names
    for (const p of products) {
        if (
            aiText.toLowerCase().includes(p.name.toLowerCase()) &&
            !seenNames.has(p.name)
        ) {
            matched.push(p);
            seenNames.add(p.name);
        }
    }

    // if no matches → fallback
    if (matched.length === 0) {
        return {
            matched,
            productDetailUrls: "\n❌ Không tìm thấy sản phẩm nào phù hợp.",
        };
    }

    // build cards
    const urls = matched.map((p) => {
        const slug = slugify(p.name, { lower: true });
        const url = `${process.env.FRONTEND_URL_NEXT}/san-pham/${slug}-${p.id}`;
        const encodedMsg = encodeURIComponent(`tôi muốn thêm ${p.name} vào giỏ hàng`);
        const imgSrc = `${process.env.IMAGE_BASE_URL}/${p.featured_image}`;

        return `
<div class="product-card" 
     style="border: 1px solid #ccc; border-radius: 8px; 
            padding: 8px; margin-bottom: 8px; 
            display: flex; align-items: center; gap: 10px; 
            background: #f8f9fa; max-width: 400px;">

  <!-- Image -->
  <img src="${imgSrc}" alt="${p.name}" 
       style="width: 70px; height: 70px; object-fit: contain; border-radius: 6px;" />

  <!-- Info -->
  <div style="flex: 1; line-height: 1.3;">
    <a href="${url}" 
       style="font-weight: bold; font-size: 14px; color: #1D4ED8; display: block; margin-bottom: 4px;" 
       target="_blank">${p.name}</a>
    <span style="font-size: 13px; color: #16A34A;">💰 ${p.price.toLocaleString()}đ</span>
  </div>

  <!-- Small Button -->
  <button class="add-to-cart-btn" 
          data-product="${p.name}" data-msg="${encodedMsg}" 
          style="background: #FACC15; color: #000; border: none; 
                 padding: 4px 8px; border-radius: 4px; 
                 font-size: 12px; font-weight: 500; cursor: pointer;">
    🛒 Thêm
  </button>
</div>
    `.trim();
    });

    return {
        matched,
        productDetailUrls: `\n${urls.join("\n")}`,
    };
}
