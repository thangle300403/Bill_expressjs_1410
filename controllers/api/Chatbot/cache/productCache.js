// src/cache/productCache.js
import productModel from "../../../../models/Product.js";

let productCache = null;

/**
 * Get all products (cached).
 */
export async function getProductCache() {
    if (!productCache) {
        console.log("⚡ Loading products into cache...");
        productCache = await productModel.getAll();
    }
    return productCache;
}

/**
 * Invalidate the cache (force reload next time).
 */
export function invalidateProductCache() {
    productCache = null;
}

export function isProductCacheLoaded() {
    return productCache !== null;
}
