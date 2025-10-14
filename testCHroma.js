// testChroma.js
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";
import dotenv from "dotenv";
dotenv.config();

const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "text-embedding-3-small",
});

(async () => {
    try {
        const vectorStore = new Chroma(embeddings, {
            collectionName: "billshop_test",
            url: "http://72.60.211.155:8000",
            collectionMetadata: { "hnsw:space": "cosine" },
        });

        await vectorStore.addDocuments([
            {
                pageContent: "BillShop AI chatbot recommends Yonex rackets.",
                metadata: { source: "test" },
            },
        ]);

        console.log("✅ Successfully added test document to Chroma!");
    } catch (err) {
        console.error("❌ Connection failed:", err);
    }
})();
