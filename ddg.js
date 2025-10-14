import "dotenv/config";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const response = await openai.responses.create({
  model: "o4-mini",
  tools: [{
    type: "web_search",
    user_location: {
      type: "approximate",
      country: "vn",
      city: "Ho Chi Minh",
      region: "Ho Chi Minh"
    }
  }],
  input: "Vợt của kento momota?",
});

console.log(response.output_text);
