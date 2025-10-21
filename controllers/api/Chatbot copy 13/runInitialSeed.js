import fs from "fs";
import path from "path";
// import { loadPolicyToVectorStore } from "../MailChatbot/vectoreStore.js";

const PROMPT_SEED_FILE = path.resolve(".chroma_seeded");
const PRODUCT_SEED_FILE = path.resolve(".chroma_product_seeded");

//XÓa file .chroma_product_seeded
export async function invalidateChromaCache() {
    if (fs.existsSync(PRODUCT_SEED_FILE)) {
        fs.unlinkSync(PRODUCT_SEED_FILE);
        console.log("✅ .chroma_seeded removed !!!! – cache invalidated");
    }
}

export async function runInitialSeeds() {

    const init = async () => {
        console.log("⏳ Loading policy.pdf into vector store...");
        await loadPolicyToVectorStore();
        console.log("✅ policy.pdf loaded into Chroma collection 'policy_docs'");
    };

    if (fs.existsSync(PROMPT_SEED_FILE)) {
        console.log("✅ Chroma already seeded. Skipping.");
        return;
    }

    console.log("🚀 Running initial seed scripts...");

    await import("././initAgents/trainConsult.js");
    await import("././initAgents/trainSql.js");
    await import("././initAgents/trainPolicy.js");
    await import("././initAgents/trainConsultDecision.js");
    // await init();

    fs.writeFileSync(PROMPT_SEED_FILE, "seeded");
    console.log("✅ Chroma seeding complete.");
}

// ✅ Chạy productDesChroma
export async function runProductSeeds() {
    if (fs.existsSync(PRODUCT_SEED_FILE)) {
        console.log("✅ Product descriptions already seeded. Skipping.");
        return;
    }

    console.log("🚀 Running product description seeder...");
    const { trainProductDescriptions } = await import("././initAgents/productDesChroma.js");
    await trainProductDescriptions();

    fs.writeFileSync(PRODUCT_SEED_FILE, "seeded");
}

