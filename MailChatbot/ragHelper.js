// ai/ragHelper.js
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";

export const getRelevantDocs = async (query, topK = 3) => {
    const vectorStore = await Chroma.fromExistingCollection(
        new OpenAIEmbeddings(),
        {
            collectionName: "mail_support",
        }
    );

    const docs = await vectorStore.similaritySearch(query, topK);
    return docs.map(doc => doc.pageContent).join("\n\n");
};
