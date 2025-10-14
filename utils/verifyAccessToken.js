import jwt from "jsonwebtoken";

export function verifyAccessToken(req, res, next) {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json({ message: "No access token" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_KEY);

        req.user = decoded;

        console.log("User", req.user);
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
}