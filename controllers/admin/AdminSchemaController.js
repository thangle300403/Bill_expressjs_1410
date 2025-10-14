const { Chroma } = require("@langchain/community/vectorstores/chroma");
const { OpenAIEmbeddings } = require("@langchain/openai");
const fs = require("fs");
const path = require("path");

const { ChromaClient } = require("chromadb");
const { trainProductDescriptions } = require("../api/Chatbot/initAgents/productDesChroma.js");
const { trainPolicy } = require("../api/Chatbot/initAgents/policyChromaExport.js");
const { trainCustomPdfCollection, trainCustomTxtCollection } = require("../api/Chatbot/initAgents/trainService.js");
const { PDFLoader } = require("@langchain/community/document_loaders/fs/pdf");

// Đường dẫn tới file schema chính
const SCHEMA_FILE_PATH = path.join(
    __dirname,
    "../../controllers/api/Chatbot/extra/schema.txt"
);

const ROOT_DIR = path.resolve(__dirname, "../..");

class AdminSchemaController {
    // Hiển thị trang index schema
    static index = async (req, res) => {
        const client = new ChromaClient({ path: process.env.CHROMA_URL });
        const collections = await client.listCollections();

        res.render("admin/schema/index", {
            layout: "admin/layout",
            collections,
        });
    };

    // Xử lý upload file txt → replace file schema hiện tại
    static upload = async (req, res) => {
        try {
            const file = req.file;

            console.log("File upload:", file);

            if (!file) {
                return res.status(400).send("Không có file được tải lên.");
            }

            // Tạo thư mục nếu chưa có
            fs.mkdirSync(path.dirname(SCHEMA_FILE_PATH), { recursive: true });

            // Ghi đè file schema hiện tại
            fs.renameSync(file.path, SCHEMA_FILE_PATH);

            req.session.message_success = "Tải schema mới thành công!";
            req.session.save(() => {
                res.redirect("/admin/schema");
            });
        } catch (err) {
            console.error("❌ Lỗi khi upload schema:", err);
            res.status(500).send("Lỗi khi upload schema: " + err.message);
        }
    };

    // Hiển thị nội dung file schema
    static view = (req, res) => {
        try {
            if (!fs.existsSync(SCHEMA_FILE_PATH)) {
                return res.status(404).send("⚠️ File schema chưa tồn tại.");
            }

            const content = fs.readFileSync(SCHEMA_FILE_PATH, "utf8");
            res.setHeader("Content-Type", "text/plain");
            res.send(content);
        } catch (err) {
            console.error("❌ Lỗi khi xem schema:", err);
            res.status(500).send("Lỗi khi xem schema: " + err.message);
        }
    };

    // Xóa file schema hiện tại
    static destroy = (req, res) => {
        try {
            if (fs.existsSync(SCHEMA_FILE_PATH)) {
                fs.unlinkSync(SCHEMA_FILE_PATH);
                req.session.message_success = "Đã xóa file schema.";
            } else {
                req.session.message_success = "Không có file để xóa.";
            }

            req.session.save(() => {
                res.redirect("/admin/schema");
            });
        } catch (err) {
            console.error("❌ Lỗi khi xóa schema:", err);
            res.status(500).send("Lỗi khi xóa schema: " + err.message);
        }
    };

    static destroySeedFile = (req, res) => {
        try {
            const file = req.query.file;
            if (!file) {
                return res.status(400).send("Thiếu tham số file.");
            }

            const allowedFiles = [".chroma_product_seeded", ".chroma_seeded"];
            if (!allowedFiles.includes(file)) {
                return res.status(400).send("Chỉ được xóa seed file.");
            }

            const targetPath = path.join(ROOT_DIR, file);

            if (fs.existsSync(targetPath)) {
                fs.unlinkSync(targetPath);
                req.session.message_success = `✅ Đã xóa file ${file}`;
            } else {
                req.session.message_success = `⚠️ File ${file} không tồn tại.`;
            }

            req.session.save(() => {
                res.redirect("/admin/schema");
            });
        } catch (err) {
            console.error("❌ Lỗi khi xóa seed file:", err);
            res.status(500).send("Lỗi khi xóa seed file: " + err.message);
        }
    };

    static deleteCollection = async (req, res) => {
        try {
            const { name } = req.query;
            if (!name) {
                return res.status(400).send("Thiếu tên collection");
            }

            const client = new ChromaClient({ path: process.env.CHROMA_URL });
            await client.deleteCollection({ name });

            req.session.message_success = `✅ Đã xóa collection '${name}'`;
            req.session.save(() => res.redirect("/admin/schema"));
        } catch (err) {
            console.error("❌ Lỗi khi xóa collection:", err);
            res.status(500).send("Lỗi khi xóa collection: " + err.message);
        }
    };

    static createCollection = async (req, res) => {
        try {
            const { name } = req.body;
            if (!name || !name.trim()) {
                req.session.message_error = "⚠️ Tên collection không hợp lệ";
                return req.session.save(() => res.redirect("/admin/schema"));
            }

            const client = new ChromaClient({ path: process.env.CHROMA_URL });

            await client.createCollection({ name: name.trim() });

            req.session.message_success = `✅ Đã tạo collection '${name}'`;
            req.session.save(() => res.redirect("/admin/schema"));
        } catch (err) {
            console.error("❌ Lỗi khi tạo collection:", err);
            res.status(500).send("Lỗi khi tạo collection: " + err.message);
        }
    };

    static seedProductDesCollection = async (req, res) => {
        const { name } = req.query;

        try {
            if (name === "product_descriptions") {
                await trainProductDescriptions();

                req.session.message_success = `✅ Đã seed collection '${name}' thành công!`;
                return req.session.save(() => res.redirect("/admin/schema"));
            }

            req.session.message_success = `✅ Đã seed collection '${name}' thành công!`;
            req.session.save(() => res.redirect("/admin/schema"));
        } catch (err) {
            console.error(`❌ Lỗi khi seed ${name}:`, err);
            req.session.message_error = `❌ Seed '${name}' thất bại: ${err.message}`;
            req.session.save(() => res.redirect("/admin/schema"));
        }
    };

    static seedCustomCollection = async (req, res) => {
        const { name } = req.query;
        const file = req.file; // multer middleware required

        if (!file) {
            req.session.message_error = "❌ Bạn cần tải lên 1 file để seed.";
            return req.session.save(() => res.redirect("/admin/schema"));
        }

        try {
            const ext = path.extname(file.originalname).toLowerCase();

            console.log("file.path type:", typeof file.path, file.path);

            if (ext === ".pdf") {
                await trainCustomPdfCollection(file.path, name);
            } else if (ext === ".txt") {
                await trainCustomTxtCollection(file.path, name);
            } else {
                throw new Error("❌ Chỉ hỗ trợ file PDF hoặc TXT.");
            }

            req.session.message_success = `✅ Đã seed collection '${name}' từ file ${file.originalname}`;
        } catch (err) {
            console.error(`❌ Lỗi khi seed ${name}:`, err);
            req.session.message_error = `❌ Seed '${name}' thất bại: ${err.message}`;
        } finally {
            if (file?.path && fs.existsSync(file.path)) {
                fs.unlinkSync(file.path); // cleanup
            }
            req.session.save(() => res.redirect("/admin/schema"));
        }
    };

    static viewCollection = async (req, res) => {
        const { name } = req.query;

        try {
            const client = new ChromaClient({ path: process.env.CHROMA_URL });
            const collection = await client.getCollection({ name });

            // Fetch first 20 docs for preview
            const results = await collection.get({
                include: ["documents", "metadatas"],
            });

            res.render("admin/schema/view-collection", {
                name,
                results,
                layout: "admin/layout",
            });
        } catch (err) {
            console.error("❌ View collection error:", err);
            res.status(500).send(`Error: ${err.message}`);
        }
    };
}

module.exports = AdminSchemaController;
