import { v4 as uuidv4 } from "uuid";

export const startSession = (req, res) => {
    let sessionId = req.cookies?.chatbot_session;

    if (!sessionId) {
        sessionId = uuidv4();
        res.cookie("chatbot_session", sessionId, {
            httpOnly: true,
            maxAge: parseInt(process.env.CHATBOT_SESSION_MAXAGE, 10),
            sameSite: "lax",
        });
    }

    res.json({ message: "Session started", sessionId });
};
