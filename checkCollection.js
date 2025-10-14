import { ChromaClient } from "chromadb";

const client = new ChromaClient({ path: process.env.CHROMA_URL });

// Change this to your collection name
const COLLECTION_NAME = "product_descriptions";

async function run() {
    try {
        const collection = await client.getCollection({ name: COLLECTION_NAME });

        // Fetch first 20 docs
        const results = await collection.get({
            include: ["documents", "metadatas"],
            limit: 20,
        });

        console.log(`📦 Collection: ${COLLECTION_NAME}`);
        console.log("Total count:", await collection.count());

        results.documents.forEach((doc, i) => {
            console.log(`\n#${i + 1}`);
            console.log("Doc:", doc);
            console.log("Meta:", results.metadatas[i]);
        });
    } catch (err) {
        console.error("❌ Error:", err);
    }
}

run();
