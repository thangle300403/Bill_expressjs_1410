//Chatbot/vectorStore.js
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import dotenv from "dotenv";
dotenv.config();

let vectorStore = null;
const collectionMap = {};

// docker pull chromadb/chroma
// docker run -p 8000:8000 chromadb/chroma

// docker pull chromadb/chroma && docker run -d --name chromadb -p 8000:8000 chromadb/chroma


export async function initVectorStore(collectionName = "chat_history") {
    const embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: "text-embedding-3-large",
    });

    vectorStore = new Chroma(embeddings, {
        collectionName, // <-- dynamic
        url: process.env.CHROMA_URL,
        collectionMetadata: {
            "hnsw:space": "cosine"
        }
    });

    console.log(`✅ Chroma vector store initialized for collection: ${collectionName}`);
}

export async function getVectorStore(collectionName = "chat_history") {
    if (!collectionMap[collectionName]) {
        const embeddings = new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY,
            modelName: "text-embedding-3-large",
        });

        const vectorStore = new Chroma(embeddings, {
            collectionName,
            url: process.env.CHROMA_URL,
            collectionMetadata: {
                "hnsw:space": "cosine",
            },
        });

        collectionMap[collectionName] = vectorStore;
    }
    return collectionMap[collectionName];
}

export async function addToVectorStore({ question, answer, email, type }, collectionName = "chat_history") {
    const vectorStore = await getVectorStore(collectionName);

    const doc = new Document({
        pageContent: question,
        metadata: { answer, email, type }
    });

    const ids = [Date.now().toString() + Math.random().toString(36).substring(2)];
    await vectorStore.addDocuments([doc], { ids });
}


export async function searchSimilar(
    question,
    topK = 5,
    minScore = 0.5,
    collectionName = "chat_history"
) {
    const vectorStore = await getVectorStore(collectionName);
    const results = await vectorStore.similaritySearchWithScore(question, topK);
    const filtered = results
        .map(([doc, distance], idx) => {
            const similarity = 1 - Math.min(Math.max(distance, 0), 1);

            // 🔍 Log to terminal
            // console.log(
            //     `#Classification ${idx + 1} (score: ${similarity.toFixed(2)}) ${doc.pageContent.slice(0, 80)}...`
            // );

            return { doc, similarity };
        })
        .filter(({ doc, similarity }) => similarity >= minScore && doc.pageContent.length >= 10)
        .map(({ doc }) => doc);

    return filtered;
}

export async function searchSimilarConsult(
    question,
    topK = 5,
    minScore = 0,
    collectionName = "product_descriptions"
) {
    const vectorStore = await getVectorStore(collectionName);
    const results = await vectorStore.similaritySearchWithScore(question, topK);

    const scored = results
        .map(([doc, distance]) => {
            // Convert cosine distance → similarity
            const similarity = 1 / (1 + distance);

            // Length-based bonus to penalize short/empty docs
            const len = doc.pageContent?.length || 0;
            const lenBonus = Math.min(len / 1000, 1);
            const penalty = len < 50 ? 0.7 : 1;
            const finalScore = (similarity * 0.7 + lenBonus * 0.3) * penalty;

            return { doc, finalScore, similarity, len };
        })
        // Sort by score descending
        .sort((a, b) => b.finalScore - a.finalScore);

    // Log top scores
    console.log("\n🔍 [searchSimilarConsult] Top Results for:", question);
    scored.slice(0, 5).forEach((r, i) => {
        console.log(
            `#Consult ${i + 1} | Score: ${r.finalScore.toFixed(4)} | Sim: ${r.similarity.toFixed(4)} | Len: ${r.len} | Title: ${r.doc.metadata?.name || "(no name)"}`
        );
    });
    console.log("-----------------------------------------------------");

    // Optionally filter & return only relevant ones
    const filtered = scored.filter(({ finalScore }) => finalScore >= minScore);
    return filtered.map(({ doc }) => doc);
}

export async function searchSimilarWithScore(
    question,
    topK = 5,
    collectionName = "intent-classification"
) {
    const vectorStore = await getVectorStore(collectionName);
    const results = await vectorStore.similaritySearchWithScore(question, topK);

    return results.map(([doc, distance]) => ({
        content: doc.pageContent,
        metadata: doc.metadata,
        distance, // smaller = better
        similarity: 1 - Math.min(Math.max(distance, 0), 1), // bigger = better
    }));
}

export async function debugListChromaContents(collectionName = "chat_history") {
    console.log(`✅ debugListChromaContents for collection: ${collectionName}`);

    const vectorStore = await getVectorStore(collectionName);

    const results = await vectorStore.similaritySearch("", 100); // fetch everything

    if (results.length === 0) {
        console.log("⚠️ No documents found in this collection.");
        return;
    }

    results.forEach((doc, i) => {
        console.log(`📦 #${i + 1}`);
        console.log("   Q:", doc.pageContent);
        console.log("   A:", doc.metadata?.answer);
        console.log("   Type:", doc.metadata?.type);
        console.log("   Email:", doc.metadata?.email);
    });
}

