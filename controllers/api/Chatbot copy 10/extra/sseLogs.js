// sseLogs.js
import { EventEmitter } from "events";
import jwt from "jsonwebtoken";

// Store log buses per user/session key
const buses = new Map();

/**
 * Get or create a log bus (EventEmitter) for a given key
 */
export function getLogBus(key) {
    if (!buses.has(key)) {
        buses.set(key, new EventEmitter());
    }
    return buses.get(key);
}

/**
 * SSE endpoint handler to stream logs to the frontend
 * @route GET /chatbot/stream-logs?session_id=...
 */
export function streamLogs(req, res) {
    const token = req.cookies?.access_token;

    const session_id = req.cookies?.chatbot_session || null;

    let email = null;
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_KEY);
            email = decoded.email;
            console.log("Email trong chatbot controller", email);
        } catch (err) {
            console.log("Invalid or expired token:", err.message);
        }
    }

    const key = email || session_id;

    if (!key) {
        return res.status(400).json({ error: "Missing session_id or user email" });
    }

    const bus = getLogBus(key);

    res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.(); // For proxy support

    // Emit log messages to this connection
    const send = (msg) => {
        res.write(`data: ${JSON.stringify(msg)}\n\n`);
    };

    const listener = (payload) => {
        send(payload);
    };

    bus.on("log", listener);

    // Ping every 15s to keep the connection alive
    const keepAlive = setInterval(() => {
        res.write(`: ping\n\n`);
    }, 15000);

    // Clean up on client disconnect
    req.on("close", () => {
        clearInterval(keepAlive);
        bus.off("log", listener);
    });
}

/**
 * Push a log to a specific user/session stream
 * @param {string} key session_id or email
 * @param {{ msg: string, step?: string }} payload
 */
export function pushLog(key, payload) {
    const bus = getLogBus(key);
    const fullPayload = {
        ts: Date.now(),
        ...payload,
    };
    bus.emit("log", fullPayload);
    console.log(`[LOG ${key}]`, fullPayload.msg);
}
