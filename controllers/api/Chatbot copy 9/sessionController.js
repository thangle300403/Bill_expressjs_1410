import { v4 as uuidv4 } from "uuid";

export const startSession = (req, res) => {
    const existing = req.cookies?.chatbot_session;
    if (!existing) {
        const newSessionId = uuidv4();
        res.cookie("chatbot_session", newSessionId, {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000,
            sameSite: "lax",
        });
    }
    res.json({ message: "Session started" });
};