import fs from "fs";
import jwt from "jsonwebtoken";
import customerModel from "../../../models/Customer.js";
import { GoogleGenAI, Modality } from "@google/genai";
import { uploadShirtImageFromURL } from "./uploadShirtImageFromURL.js";
import path from "path";
import { fileURLToPath } from "url";



const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const askImageBot = async (req, res) => {
    try {
        // 1. Authenticate user
        // const token = req.headers.authorization?.split(" ")[1];
        // if (!token) return res.status(401).json({ message: "Unauthorized" });

        // const decoded = jwt.verify(token, process.env.JWT_KEY);
        // const email = decoded.email;
        // const customer = await customerModel.findEmail(email);

        // 2. Validate input
        const userImagePath = req.file?.path;
        console.log("📥 Reading user image from:", userImagePath);


        const shirtImageUrl = req.body.shirt_image_url;
        console.log("🌐 Downloading shirt image from:", shirtImageUrl);

        const shirtName = req.body.shirt;

        if (!userImagePath || !shirtImageUrl || !shirtName) {
            return res.status(400).json({ message: "Thiếu ảnh hoặc tên sản phẩm." });
        }

        // 3. Load user image (local)
        const userImageBase64 = fs.readFileSync(userImagePath).toString("base64");

        // 4. Load shirt image (download to temp and read)
        const shirtImageResult = await uploadShirtImageFromURL(shirtImageUrl);
        console.log("📥 Reading shirt image from:", shirtImageResult.path);


        const shirtImageBase64 = fs.readFileSync(shirtImageResult.path).toString("base64");

        fs.unlinkSync(shirtImageResult.path);
        // 5. Build contents
        const contents = [
            {
                inlineData: {
                    mimeType: "image/png",
                    data: userImageBase64,
                },
            },
            {
                inlineData: {
                    mimeType: "image/png",
                    data: shirtImageBase64,
                },
            },
            {
                text: `
            You are a smart virtual try-on assistant for SportZone.vn — an AI that helps customers visualize whether a chosen product (such as a shirt) suits their personal appearance.

Purpose:
Generate a realistic photo of the uploaded person standing in a professional badminton court. 
The person should be wearing the selected product (shirt/shoes) and holding badminton gear (racket/shuttlecock bag). 
Ensure the colors of the outfit match naturally with the person’s skin tone and face (No need to blur the face).
Maintain photorealistic lighting and perspective so the result looks like a real badminton player photo.

The customer has uploaded two images:
1. A full-body photo of themselves.
2. A photo of the selected product: ${shirtName}.

Your task:
- Analyze the customer’s body shape, posture, lighting, and skin tone.
- Overlay the selected product onto the customer **realistically and in correct proportion**, making it appear naturally worn.
- Preserve the customer’s original face, posture, lighting, and identity.
- The background may be retained or improved for clarity.
- If the input image is blurry or unclear, politely request a better one.

Output:
- Return a new PNG image (via \`inlineData\`) showing the customer wearing the product.
- Include one **short sentence in Vietnamese** describing how the product complements the user's appearance, skin tone, or style.
        `,
            },
        ];

        console.log("🧪 Dữ liệu nhận được:", {
            shirtName,
            shirtImageUrl,
            userImagePath,
        });


        console.log("📦 Sending to Gemini...");


        // 6. Call Gemini
        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash-image-preview",
            contents,
            config: {
                responseModalities: [Modality.TEXT, Modality.IMAGE],
            },
        });

        const parts = result.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find((p) => p.inlineData);
        const textPart = parts.find((p) => p.text);

        if (!imagePart) {
            return res.status(200).json({
                message: "Gemini không trả về ảnh.",
                aiText: textPart?.text || null,
            });
        }

        const generatedDir = path.join(__dirname, "../../../generated");
        if (!fs.existsSync(generatedDir)) {
            fs.mkdirSync(generatedDir, { recursive: true });
        }

        // Save the generated image there
        const filename = `generated-${Date.now()}.png`;
        const outPath = path.join(generatedDir, filename);

        const imageBuffer = Buffer.from(imagePart.inlineData.data, "base64");
        fs.writeFileSync(outPath, imageBuffer);

        console.log("✅ Image saved to:", outPath);

        res.json({
            message: "Đã tạo ảnh thành công!",
            aiText: textPart?.text || null,
            generatedImageUrl: `${process.env.IMAGE_GENERATED}/${path.basename(outPath)}`,
        });
    } catch (err) {
        console.error("❌ Error in askImageBot:", err);
        res.status(500).json({ error: err.message });
    }
};
