// controllers/admin/AdminChatMCPController.js
const { adminGraph } = require("../../controllers/admin/langgraph/adminGraph");
const { saveChatMessage } = require("../../models/ChatMcpAdmin");
const { getAdminCreds } = require("../../utils/adminCre");
const { decrypt, encrypt } = require("../api/Chatbot/extra/encrypt");
const ChatMcpAdmin = require("../../models/ChatMcpAdmin");

class AdminChatMCPController {
    static async chat(req, res) {
        try {
            const question = req.body.question;

            console.log("Question:", question);
            const creds = getAdminCreds(req);
            if (!creds) {
                return res.status(401).json({ answer: "Bạn chưa đăng nhập" });
            }

            // 1. Save user message
            await saveChatMessage({
                role: "user",
                content: encrypt(question),
                email: creds.email
            })

            const historyLogs = await ChatMcpAdmin.findByEmail(creds.email);

            // Map to messages for LangGraph
            const pastMessages = historyLogs.map(log => ({
                role: log.role,
                content: log.content
            }));

            const result = await adminGraph.invoke({
                messages: pastMessages,
                credentials: { email: creds.email, password: creds.password }
            });

            // Return the last message from AI
            const lastMsg = result.messages[result.messages.length - 1];

            if (lastMsg?.role === "ai" && lastMsg?.content) {
                await saveChatMessage({
                    role: "ai",
                    content: encrypt(lastMsg.content),
                    email: creds.email
                });
            }

            console.log("Answer:", lastMsg.content);

            res.json({ answer: lastMsg.content });
        } catch (err) {
            console.error("❌ Admin chatbot error:", err);
            res.status(500).json({ answer: "Internal error: " + err.message });
        }
    }

    static async chatbotLogin(req, res) {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).send("Thiếu email hoặc mật khẩu");
        }

        // pack creds
        const payload = JSON.stringify({ email, password, ts: Date.now() });

        // encrypt
        const token = encrypt(payload);

        // set cookie
        res.cookie("admin_auth", token, {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 24
        });

        res.json({ ok: true });
    }

    static async checkLogin(req, res) {
        const token = req.cookies?.admin_auth;
        if (!token) return res.status(401).json({ ok: false });
        try {
            const creds = JSON.parse(decrypt(token));
            if (!creds.email) throw new Error("bad token");
            return res.json({ ok: true });
        } catch {
            return res.status(401).json({ ok: false });
        }
    }

    static async getHistory(req, res) {
        try {
            const creds = getAdminCreds(req);
            if (!creds) {
                return res.status(401).json({ error: "Bạn chưa đăng nhập" });
            }

            const logs = await ChatMcpAdmin.findByEmail(creds.email);
            res.json({ logs });
        } catch (err) {
            console.error("❌ Error fetching history:", err);
            res.status(500).json({ error: "Failed to load chat history." });
        }
    }

    static async logout(req, res) {
        res.clearCookie("admin_auth");
        res.status(200).json({ message: "Logged out" });
    }
}

module.exports = AdminChatMCPController;
