// scripts/listAllProductsFromChroma.js
import dotenv from "dotenv";
dotenv.config();

import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";

const COLLECTION_NAME = "product_descriptions";

async function getVectorStore() {
    const embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: "text-embedding-3-small",
    });

    return new Chroma(embeddings, {
        collectionName: COLLECTION_NAME,
        url: process.env.CHROMA_URL,
        collectionMetadata: { "hnsw:space": "cosine" },
    });
}

async function listAllProductsFromChroma() {
    try {
        const vectorStore = await getVectorStore();

        // Get everything (use large k to fetch all docs)
        const results = await vectorStore.similaritySearch("", 200);

        if (results.length === 0) {
            console.log(`⚠️ No documents found in collection: ${COLLECTION_NAME}`);
            return;
        }

        console.log(`✅ Found ${results.length} documents in collection: ${COLLECTION_NAME}`);
        results.forEach((doc, i) => {
            console.log(`\n📦 #${i + 1}`);
            console.log("   Content:", doc.pageContent.slice(0, 150) + (doc.pageContent.length > 150 ? "..." : ""));
            console.log("   Metadata:", doc.metadata);
        });
    } catch (err) {
        console.error("❌ Error listing Chroma contents:", err);
    }
}

listAllProductsFromChroma();
