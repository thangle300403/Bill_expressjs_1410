// routes/contactAction.controller.js
import { emailGraph } from "./emailGraph.js";

export const runEmailAI = async (req, res) => {
    try {
        const { content, actionType } = req.body;

        const result = await emailGraph.invoke({
            input: content,
            actionType,
            history: [{ role: "user", content }]
        });

        res.json({ result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
