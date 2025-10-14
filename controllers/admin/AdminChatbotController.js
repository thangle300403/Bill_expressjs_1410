const { adminSupervisorGraph } = require("./AdminChatbot/graph/supervisorGraph");
const commentModel = require("../../models/Comment");
const { saveChatLog } = require("./ChatLogger");
const chatbotAdminModel = require("../../models/ChatbotAdmin");

class AdminChatbotController {
    // ✅ Xử lý câu hỏi chatbot
    static respond = async (req, res) => {
        const { question } = req.body;
        const comments = await commentModel.all();

        console.log("Question:", question);

        const result = await adminSupervisorGraph.invoke({
            user_task: question,
            question,
            comments,
        });

        const answer =
            result?.summary ||
            (result.flagged?.length > 0
                ? `⚠️ Phát hiện ${result.flagged.length} bình luận vi phạm.`
                : "✅ Không có bình luận vi phạm.");

        // ✅ Lưu lịch sử chat
        await saveChatLog({
            role: "user",
            content: question,
            email: req.session?.staff_email,
        });

        await saveChatLog({
            role: "ai",
            content: answer,
            email: req.session?.staff_email,
        });

        res.json({
            answer,
            flagged: result.flagged || []
        });
    }

    // ✅ Hiển thị bình luận và logs trong cùng trang
    static getChatLogs = async (req, res) => {
        const email = req.session?.staff_email;

        if (!email) {
            return res.status(401).json({ message: "Chưa đăng nhập" });
        }

        try {
            const logs = await chatbotAdminModel.findByEmail(email);
            res.json({ logs });
        } catch (err) {
            console.error("❌ Error fetching chat logs:", err);
            res.status(500).json({ message: "Lỗi server" });
        }
    }

}

module.exports = AdminChatbotController;
