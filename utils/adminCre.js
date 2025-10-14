import { decrypt } from "../controllers/api/Chatbot/extra/encrypt.js";

export function getAdminCreds(req) {
    const token = req.cookies?.admin_auth;
    if (!token) return null;
    try {
        const decrypted = decrypt(token);
        return JSON.parse(decrypted);
    } catch (err) {
        console.warn("Cookie decrypt fail:", err.message);
        return null;
    }
}
