export const addToCartTool = {
    name: "add_to_cart",
    description:
        "Adds the currently matched product to the user's cart. If no product is matched, automatically routes to match_product.",
};

export const matchProductTool = {
    name: "match_product",
    description:
        "Finds and selects the most relevant product mentioned in the user's message. Always call this before add_to_cart.",
};