// utils/parseEmbedding.js
export function parseEmbeddingString(str) {
    try {
        return JSON.parse(str);
    } catch (e) {
        return [];
    }
}
