import fs from "fs";
import path from "path";
// import { loadPolicyToVectorStore } from "../MailChatbot/vectoreStore.js";

const SEED_FLAG_FILE = path.resolve(".chroma_seeded");

export async function runInitialSeeds() {

    const init = async () => {
        console.log("⏳ Loading policy.pdf into vector store...");
        await loadPolicyToVectorStore();
        console.log("✅ policy.pdf loaded into Chroma collection 'policy_docs'");
    };

    if (fs.existsSync(SEED_FLAG_FILE)) {
        console.log("✅ Chroma already seeded. Skipping.");
        return;
    }

    console.log("🚀 Running initial seed scripts...");

    await import("././initAgents/trainConsult.js");
    await import("././initAgents/trainSql.js");
    await import("././initAgents/trainPolicy.js");
    // await init();

    fs.writeFileSync(SEED_FLAG_FILE, "seeded");
    console.log("✅ Chroma seeding complete.");
}

