require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const apiKey = process.env.GEMINI_API_KEY;  // Accessing the API key from environment variables
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-pro",
});

const generationConfig = {
    temperature: 0.4,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 600,
    responseMimeType: "text/plain",
};

async function chatbotResponse(userInput) {
    const chatSession = model.startChat({
        generationConfig,
        // safetySettings: Adjust safety settings
        // See https://ai.google.dev/gemini-api/docs/safety-settings
        history: [
            {
                role: "user",
                parts: [
                    {
                        text: `"Chào mừng đến với thế giới cầu lông cùng Bill Cipher, chuyên gia của bạn về mọi thứ liên quan đến cầu lông! Từ thống kê và thành tích của các tay vợt hàng đầu đến các thiết bị tốt nhất—vợt, giày, quần áo và nhiều hơn nữa—Bill đều có tất cả. Hãy hỏi bất kỳ điều gì, và tôi sẽ giúp bạn trang bị để chiến thắng trên sân đấu!"`,
                    },
                ],
            },
            {
                role: "model",
                parts: [
                    {
                        text: "Chà, ý tưởng rất thú vị! Bill Cipher trở thành chuyên gia cầu lông là một sự kết hợp đầy bất ngờ và hài hước.",
                    },
                ],
            },
        ],
    });

    const result = await chatSession.sendMessage(userInput);
    return result.response.text();  // Returning the chatbot's response as text
}

class ChatbotController {

    // Render the chatbot index page
    static form = async (req, res) => {
        try {
            // Renders the chatbot view (index.html or EJS equivalent)
            res.render('chatbot/index', {});
        } catch (error) {
            res.status(500).send(error.message);
        }
    }
    // Handle user input and fetch chatbot response
    static getResponse = async (req, res) => {
        const userInput = req.body.input;  // User input from the request
        const vietnameseInput = `Hãy trả lời bằng tiếng việt: ${userInput}`;
        try {
            const response = await chatbotResponse(vietnameseInput); // Call the AI function with user input
            res.json({ response });  // Return the AI response as JSON
        } catch (error) {
            res.status(500).json({ error: 'Failed to get response from AI' });
        }
    }
}
module.exports = ChatbotController;
