// chatbot/uploadGeminiHelper.js
import fs from "fs";
import path from "path";
import axios from "axios";

// ✅ Accept full absolute path directly
export async function uploadImageToGemini(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const mimeType = "image/png"; // or detect dynamically

    const response = await axios.post(
        `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${process.env.GEMINI_API_KEY}`,
        fileBuffer,
        {
            headers: {
                "Content-Type": mimeType,
                "X-Goog-Upload-Command": "start, upload, finalize",
                "X-Goog-Upload-Header-Content-Length": fileBuffer.length,
                "X-Goog-Upload-Header-Content-Type": mimeType,
            },
        }
    );

    return response.data.file;
}

