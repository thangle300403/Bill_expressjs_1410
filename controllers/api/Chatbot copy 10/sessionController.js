import { v4 as uuidv4 } from "uuid";

export const startSession = (req, res) => {
    let sessionId = req.cookies?.chatbot_session;

    if (!sessionId) {
        sessionId = uuidv4();
        res.cookie("chatbot_session", sessionId, {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            sameSite: "lax",
        });
    }

    res.json({ message: "Session started", sessionId });
};
