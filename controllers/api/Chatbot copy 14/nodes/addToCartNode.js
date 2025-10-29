import { pushLog } from "../extra/sseLogs.js";
import { saveChatHistory } from "../memory/saveChatHistory.js";

export async function addToCartNode(state) {
    console.log("🛒 Tool Adding name to cart is called");
    const { cartProduct, email, session_id } = state;

    // --- Case FAIL: chưa có sản phẩm ---
    if (!cartProduct || !cartProduct.product) {
        console.warn("⚠️ addToCartNode: chưa có sản phẩm, quay lại match_product");

        const prevUsed = Array.isArray(state.used_tool)
            ? state.used_tool
            : state.used_tool
                ? [state.used_tool]
                : [];

        const newUsedTools = [...new Set([...prevUsed, "match_product"])];

        return {
            ...state,
            messages: [
                ...state.messages,
                {
                    role: "ai",
                    content:
                        "Đang lấy thông tin sản phẩm để thêm vào giỏ. Vui lòng đợi...",
                },
            ],
            current_step: "match_product", // ép quay lại match_product
            used_tool: newUsedTools, // ✅ chỉ log match_product
        };
    }

    // --- Case SUCCESS: đã có product ---
    const p = cartProduct.product;

    const logKey = email || session_id;
    const log = (msg, step) => pushLog(logKey, { msg, step });

    console.log("logKey in addToCartNode:", logKey);

    console.log("🛒 Tool Adding name to cart:", p.name);
    log(`🛒 Đang xử lý thêm sản phẩm **${p.name}** vào giỏ...`, "add-to-cart");

    const hasDiscount =
        p.discount_percentage > 0 && p.discount_from_date && p.discount_to_date;

    log(`Đang xem có giảm giá hay không: ${hasDiscount}`, "sale_price");

    const sale_price = hasDiscount
        ? Math.round(p.price * (1 - p.discount_percentage / 100))
        : p.price;

    const item = {
        id: p.product_id,
        name: p.name,
        sale_price,
        imageUrl: `${process.env.IMAGE_BASE_URL}/${p.featured_image}`,
        quantity: cartProduct.quantity,
    };

    console.log("🛒 Tool Adding item to cart:", item);
    log(`Tổng hợp thông tin sản phẩm`, "product-info-added-to-cart");

    const prevUsed = Array.isArray(state.used_tool)
        ? state.used_tool
        : state.used_tool
            ? [state.used_tool]
            : [];

    const newUsedTools = [...new Set([...prevUsed, "add_to_cart"])];

    const aiText = `✅ Đã thêm sản phẩm ${p.name} vào giỏ.`;

    const his = await saveChatHistory({
        email,
        session_id,
        role: "ai",
        content: aiText,
    });

    console.log("his in addToCartNode:", his);

    return {
        ...state,
        messages: [
            ...state.messages,
            {
                role: "ai",
                content: aiText,
                additional_kwargs: { tag: "add_to_cart_confirmation" },
            },
        ],
        cartOutput: {
            role: "ai",
            action: "add_to_cart",
            item,
        },
        current_step: "__end__",
        used_tool: newUsedTools,
    };
}
