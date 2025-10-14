import { pushLog } from "../extra/sseLogs.js";

export async function addToCartNode(state) {
    console.log("🛒 Tool Adding name to cart is called");
    const { cartProduct, email, session_id } = state;
    const p = cartProduct.product;

    const logKey = email || session_id;
    const log = (msg, step) => pushLog(logKey, { msg, step });

    console.log("🛒 Tool Adding name to cart:", p.name);
    log(`🛒 Đang xử lý thêm sản phẩm **${p.name}** vào giỏ...`, "add-to-cart");

    const hasDiscount =
        p.discount_percentage > 0 &&
        p.discount_from_date &&
        p.discount_to_date;

    log(`Đang xem có giảm giá hay không: ${hasDiscount}`, "sale_price");

    const sale_price = hasDiscount
        ? Math.round(p.price * (1 - p.discount_percentage / 100))
        : p.price;

    const item = {
        id: p.id,
        name: p.name,
        sale_price,
        imageUrl: `http://localhost:3069/images/${p.featured_image}`,
        quantity: cartProduct.quantity,
    };

    console.log("🛒 Tool Adding item to cart:", item.name);
    log(`Tổng hợp thông tin sản phẩm`, "product-info-added-to-cart");

    const prevUsed = Array.isArray(state.used_tool)
        ? state.used_tool
        : state.used_tool
            ? [state.used_tool]
            : [];

    const newUsedTools = [...new Set([...prevUsed, "add_to_cart"])];

    return {
        ...state,
        messages: [
            ...state.messages,
            {
                role: "ai",
                content: `✅ Đã thêm **${item.name}** vào giỏ hàng (x${item.quantity}).`,
                additional_kwargs: { tag: "add_to_cart_confirmation" },
            },
        ],
        cartOutput: {
            role: "ai",
            action: "add_to_cart",
            item, // ✅ frontend can push this directly to LS
        },
        current_step: "consult",
        used_tool: newUsedTools,
    };
}
