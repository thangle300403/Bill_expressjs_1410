// routes/auth.js (hoặc routes/refresh.js)

import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();

router.post("/refresh", (req, res) => {
    const refreshToken = req.cookies.refresh_token;

    if (!refreshToken) {
        return res.status(401).json({ message: "No refresh token provided" });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const payload = {
            id: decoded.id,
            email: decoded.email,
            name: decoded.name,
        };

        // ✅ Tạo access token mới
        const accessToken = jwt.sign(payload, process.env.JWT_KEY, {
            expiresIn: "10m",
        });

        // ✅ Gửi lại access_token cookie mới
        res.cookie("access_token", accessToken, {
            httpOnly: true,
            secure: false, // đổi thành true nếu dùng HTTPS
            sameSite: "strict",
            path: "/",
            maxAge: 15 * 60 * 1000,
        });

        res.status(200).json({ message: "Access token refreshed" });
    } catch (err) {
        return res.status(403).json({ message: "Invalid refresh token" });
    }
});

export default router;
