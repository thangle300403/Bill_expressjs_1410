// ai/vectorStore.js
import fs from "fs";
import pdf from "pdf-parse";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import path from "path";

export const loadPolicyToVectorStore = async () => {

    const pdfPath = path.resolve(__dirname, "../../../..", "policy.pdf");
    const pdfBuffer = fs.readFileSync(pdfPath);

    // Extract text from PDF
    const data = await pdf(pdfBuffer);
    const chunks = data.text.split("\n\n").filter(Boolean);

    // Convert to LangChain Documents
    const documents = chunks.map(
        (text, i) => new Document({ pageContent: text.trim(), metadata: { page: i + 1 } })
    );

    // Create or load Chroma collection named 'mail_support'
    const vectorStore = await Chroma.fromDocuments(documents, new OpenAIEmbeddings(), {
        collectionName: "mail_support",
    });

    return vectorStore;
};
