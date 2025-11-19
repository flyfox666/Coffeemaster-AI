import { GoogleGenAI, Type } from "@google/genai";
import { Recipe, Language } from "../types";

// NOTE: process.env.API_KEY is injected automatically in the runtime environment.
const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates a structured coffee recipe based on user input.
 * Uses gemini-2.5-flash for speed and JSON structure.
 */
export const generateCoffeeRecipe = async (userRequest: string, language: Language): Promise<Recipe> => {
  const ai = getAiClient();
  
  const langInstruction = language === 'zh' 
    ? "Respond strictly in Simplified Chinese (简体中文)." 
    : "Respond in English.";

  const prompt = `You are a world-class coffee master. Create a detailed coffee recipe for: "${userRequest}". ${langInstruction}
  Include a catchy title, brief description, list of ingredients, detailed step-by-step instructions, and pro tips.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
          steps: { type: Type.ARRAY, items: { type: Type.STRING } },
          tips: { type: Type.STRING },
        },
        required: ["title", "description", "ingredients", "steps", "tips"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("No recipe generated");
  return JSON.parse(text) as Recipe;
};

/**
 * Generates a high-quality instructional or visual representation of the coffee.
 * Uses imagen-4.0-generate-001 for best quality.
 */
export const generateRecipeImage = async (recipeTitle: string, recipeDescription: string): Promise<string> => {
  const ai = getAiClient();
  // Updated prompt to focus on instructional diagram/layers/ratios as requested
  // Added strict instruction for English text to avoid garbled Chinese characters
  const prompt = `A professional coffee guide infographic for "${recipeTitle}". 
  The image should feature a high-quality, photorealistic cross-section view of the drink in a clear glass to demonstrate the distinct layers and ratios (e.g., espresso shot, steamed milk, foam, ice, water). 
  Context: ${recipeDescription}.
  Style: Clean, modern culinary diagram, 8k resolution, bright lighting, instructional but beautiful.
  CRITICAL: All text, labels, and annotations inside the image MUST be in ENGLISH. Do not use Chinese or non-English characters.`;

  const response = await ai.models.generateImages({
    model: 'imagen-4.0-generate-001',
    prompt: prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: '4:3',
      outputMimeType: 'image/jpeg',
    },
  });

  const base64Image = response.generatedImages?.[0]?.image?.imageBytes;
  if (!base64Image) throw new Error("Failed to generate image");
  
  return `data:image/jpeg;base64,${base64Image}`;
};

/**
 * Generates a specific action shot for a recipe step.
 */
export const generateStepImage = async (stepText: string, recipeTitle: string): Promise<string> => {
  const ai = getAiClient();
  // Added strict instruction for English text
  const prompt = `Close-up instructional photography of this step in making ${recipeTitle}: "${stepText}". 
  Focus clearly on the hands, equipment, and action (e.g., pouring milk, tamping espresso, stirring). 
  Style: Bright, clean, photorealistic, cinematic lighting, shallow depth of field.
  CRITICAL: Any text visible in the image (e.g. on labels, screens, or overlays) MUST be in ENGLISH. Do not use Chinese characters.`;

  const response = await ai.models.generateImages({
    model: 'imagen-4.0-generate-001',
    prompt: prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: '1:1', // Square for step icons
      outputMimeType: 'image/jpeg',
    },
  });

  const base64Image = response.generatedImages?.[0]?.image?.imageBytes;
  if (!base64Image) throw new Error("Failed to generate step image");
  
  return `data:image/jpeg;base64,${base64Image}`;
};

/**
 * Chat with the Coffee Expert.
 * Uses gemini-3-pro-preview for complex reasoning and Google Search grounding for up-to-date info.
 */
export const chatWithCoffeeExpert = async (
  history: { role: string; parts: { text: string }[] }[],
  message: string,
  language: Language
) => {
  const ai = getAiClient();

  const systemInstruction = language === 'zh'
    ? "你是一位专业的咖啡大师。请用中文回答关于咖啡豆、冲煮方法和咖啡文化的问题。使用提供的搜索工具来获取最新信息。"
    : "You are a professional coffee master. Answer questions about coffee beans, brewing methods, and coffee culture. Use the search tool for up-to-date information.";

  const contents = [
    ...history,
    { role: 'user', parts: [{ text: message }] }
  ];

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: contents,
    config: {
      systemInstruction: systemInstruction,
      tools: [{ googleSearch: {} }],
    }
  });

  return response;
};
