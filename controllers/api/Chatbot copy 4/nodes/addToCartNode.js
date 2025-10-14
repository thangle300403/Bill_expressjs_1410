export async function addToCartNode(state) {
    const { cartProduct } = state;

    console.log("🛒 Adding to cart:", cartProduct.product.name);

    const item = {
        id: cartProduct.product.id,
        name: cartProduct.product.name,
        sale_price: cartProduct.product.price, // or sale_price if renamed
        imageUrl: cartProduct.product.thumbnail || "", // match LS field
        quantity: cartProduct.quantity,
    };

    console.log("🛒 Adding to cart:", item);

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
