import dotenv from "dotenv";
dotenv.config();

import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";
import path from "path";

const clean = (text) =>
    text
        .replace(/\u2018|\u2019|\u201A/g, "'")
        .replace(/\u201C|\u201D|\u201E/g, '"')
        .replace(/\u2013|\u2014/g, "-")
        .replace(/\r?\n|\r/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const filePath = path.resolve("policy.pdf");

const run = async () => {
    console.log("📄 Loading policy.pdf...");
    const loader = new PDFLoader(filePath);
    let docs = await loader.load();

    docs = docs
        .map((doc) => ({
            pageContent: clean(doc.pageContent),
            metadata: {}, // clear to avoid schema issues
        }))
        .filter((doc) => doc.pageContent.length >= 20);

    console.log(`📄 ${docs.length} valid chunks to embed.`);

    const embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
    });

    // Step 1: Create empty store connection
    const vectorStore = new Chroma(embeddings, {
        collectionName: "policies",
        url: "http://localhost:8000",
    });

    // Step 2: Add manually
    await vectorStore.addDocuments(docs);
    console.log("✅ Successfully seeded Chroma with policy PDF content into 'policies'.");
};

run().catch((err) => {
    console.error("❌ Failed to seed policy:", err.message);
});
