import path from "path";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const clean = (text) =>
    text
        .replace(/\u2018|\u2019|\u201A/g, "'")
        .replace(/\u201C|\u201D|\u201E/g, '"')
        .replace(/\u2013|\u2014/g, "-")
        .replace(/\r?\n|\r/g, " ")
        .replace(/\s+/g, " ")
        .trim();

export async function trainCustomPdfCollection(filePath, collectionName) {

    console.log("DEBUG trainCustomPdfCollection input:", filePath);

    // 🔑 Ensure we always have a string
    if (Array.isArray(filePath)) {
        filePath = filePath[0];
    }

    const absPath = path.resolve(filePath); // ✅ now guaranteed string
    console.log("📄 Using file:", absPath);

    const loader = new PDFLoader(absPath, { splitPages: true });
    let docs = await loader.load();

    docs = docs
        .map((doc) => ({
            pageContent: clean(doc.pageContent),
            metadata: {},
        }))
        .filter((doc) => doc.pageContent.length >= 20);

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
    });
    docs = await splitter.splitDocuments(docs);

    const embeddings = new OpenAIEmbeddings({
        apiKey: process.env.OPENAI_API_KEY,
    });

    const vectorStore = new Chroma(embeddings, {
        collectionName,
        url: process.env.CHROMA_URL,
    });

    await vectorStore.addDocuments(docs);

    console.log(`✅ Seeded ${docs.length} docs into Chroma (${collectionName})`);
}
