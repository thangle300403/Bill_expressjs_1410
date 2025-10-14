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
        modelName: "text-embedding-3-small",
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
            modelName: "text-embedding-3-small",
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

export async function searchSimilar(question, topK = 5, minScore = 0.05, collectionName = "chat_history") {
    const vectorStore = await getVectorStore(collectionName);

    // console.log(`🔍 searchSimilar: "${question}"`);

    const results = await vectorStore.similaritySearchWithScore(question, topK);

    // results.forEach(([doc, score]) => {
    //     console.log(`📈 SIM: ${score.toFixed(3)} → ${doc.pageContent}`);
    // });

    const filtered = results
        .filter(([doc, score]) => score >= minScore && doc.pageContent.length >= 10)
        .map(([doc]) => doc);

    // console.log(`🔍 searchSimilar found ${filtered.length} results`);
    return filtered;
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

