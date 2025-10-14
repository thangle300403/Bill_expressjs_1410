import dotenv from "dotenv";
dotenv.config();

import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";
import path from "path";

const COLLECTION_NAME = "policies";

const clean = (text) =>
    text
        .replace(/\u2018|\u2019|\u201A/g, "'")
        .replace(/\u201C|\u201D|\u201E/g, '"')
        .replace(/\u2013|\u2014/g, "-")
        .replace(/\r?\n|\r/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const filePath = path.resolve("policy.pdf");

/**
 * Seed policy.pdf into Chroma
 */
export async function trainPolicy() {
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

    const vectorStore = new Chroma(embeddings, {
        collectionName: COLLECTION_NAME,
        url: process.env.CHROMA_URL,
    });

    await vectorStore.addDocuments(docs);

    console.log(`✅ Seeded ${docs.length} docs into Chroma (${COLLECTION_NAME})`);
}

