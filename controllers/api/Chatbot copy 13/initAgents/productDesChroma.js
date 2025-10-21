import dotenv from "dotenv";
dotenv.config();

import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import productModel from "../../../../models/Product.js";
import * as cheerio from "cheerio";

const COLLECTION_NAME = "product_descriptions";

// 🔁 Shared text splitter
const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 4000,
    chunkOverlap: 200,
});

function cleanDescription(rawHtml) {
    if (!rawHtml) return "";

    // 1️⃣ Load HTML and extract visible text
    const $ = cheerio.load(rawHtml);
    let text = $.text();

    // 2️⃣ Remove inline JSON blobs like {"price":...}
    text = text.replace(/\{[^}]+\}/g, "");

    // 3️⃣ Remove redundant whitespace and entities
    text = text.replace(/\s+/g, " ").replace(/&nbsp;/g, " ").trim();

    // 4️⃣ Optional: remove numbers like prices (e.g., 5000000)
    text = text.replace(/\b\d{4,}\b/g, "");

    return text;
}

// 🔁 Build chunks for one product
async function buildChunksFromProduct(product) {
    const raw = product.description || product.name || "";
    const content = cleanDescription(raw);

    if (!content.trim() || content.length < 30) return []; // skip too short

    return splitter.splitDocuments([
        new Document({
            pageContent: content,
            metadata: {
                product_id: product.id,
                name: product.name,
                price: product.price,
                discount_percentage: product.discount_percentage,
                discount_from_date: product.discount_from_date,
                discount_to_date: product.discount_to_date,
                featured_image: product.featured_image,
            },
        }),
    ]);
}


// 🔁 Get Chroma vector store instance
async function getVectorStore() {
    const embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: "text-embedding-3-large",
    });

    return new Chroma(embeddings, {
        collectionName: COLLECTION_NAME,
        url: process.env.CHROMA_URL, // must point to your Chroma server (http://localhost:8000)
        collectionMetadata: { "hnsw:space": "cosine" },
    });
}

// ✅ Seed toàn bộ product descriptions
export async function trainProductDescriptions() {
    const products = await productModel.getAll();
    const vectorStore = await getVectorStore();
    const collection = await vectorStore.ensureCollection();

    // ❌ old code used undefined product_id and _collection
    // ✅ correct way: clear all docs in this collection
    await collection.delete({});

    const allChunks = [];
    for (const p of products) {
        const chunks = await buildChunksFromProduct(p);
        allChunks.push(...chunks);
    }

    if (allChunks.length === 0) {
        console.warn("⚠️ No product descriptions found to embed.");
        return;
    }

    const ids = allChunks.map(
        (doc, i) =>
            `product_${doc.metadata.product_id}_${i}_${Date.now()}_${Math.random()
                .toString(36)
                .substring(2)}`
    );

    await vectorStore.addDocuments(allChunks, { ids });

    console.log(
        `✅ Seeded ${allChunks.length} product descriptions into Chroma (${COLLECTION_NAME})`
    );
}

// ✅ Update/Xoá 1 sản phẩm
export async function updateSingleProductEmbedding(productId, type = "update") {
    const vectorStore = await getVectorStore();
    const collection = await vectorStore.ensureCollection();

    // remove old vectors for this product
    await collection.delete({ where: { product_id: productId } });

    if (type === "delete") {
        console.log(`🗑️ Deleted vectors for product_id=${productId}`);
        return;
    }

    const product = await productModel.find(productId);
    if (!product) {
        console.warn(`⚠️ No product found with id=${productId}`);
        return;
    }

    const chunks = await buildChunksFromProduct(product);
    if (chunks.length === 0) {
        console.warn(
            `⚠️ Product ${productId} has no usable description or name.`
        );
        return;
    }

    const ids = chunks.map(
        (doc, i) =>
            `product_${doc.metadata.product_id}_${i}_${Date.now()}_${Math.random()
                .toString(36)
                .substring(2)}`
    );

    await vectorStore.addDocuments(chunks, { ids });
    console.log(
        `✅ Updated Chroma for product_id=${productId} with ${chunks.length} chunks`
    );
}

if (import.meta.url === `file://${process.argv[1]}`) {
    trainProductDescriptions();
}