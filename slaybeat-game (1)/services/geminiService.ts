
import { GoogleGenAI, Type } from "@google/genai";

// Initialize using process.env.API_KEY directly as required by guidelines
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateMonsterImage = async (name: string, level: number) => {
  // CRITICAL: Create a new GoogleGenAI instance right before making an API call 
  // to ensure it always uses the most up-to-date API key from the selection dialog.
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: `Original character concept for a fantasy game monster (non-copyrighted style). Name: ${name}, level ${level}. Detailed, stylized fantasy illustration, vibrant colors, isolated on mystical background.` }]
      },
      config: {
        imageConfig: { aspectRatio: "4:3", imageSize: "1K" }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      // Find the image part, do not assume it is the first part.
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
  } catch (err: any) {
    console.error("AI Generation failed:", err);
    // If the request fails with "Requested entity was not found.", reset key selection
    if (err.message?.includes("Requested entity was not found") && window.aistudio) {
       window.aistudio.openSelectKey();
    }
  }
  return `https://picsum.photos/seed/${name}/400/300`;
};

export const generateWeaponIcon = async (prompt: string) => {
  // CRITICAL: Create a new GoogleGenAI instance right before making an API call
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: `Original weapon game asset: ${prompt}. Unique design, glowing magical aura, clean icon style, isolated black background.` }]
      },
      config: {
        imageConfig: { aspectRatio: "1:1", imageSize: "1K" }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      // Find the image part
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
  } catch (err: any) {
    console.error("AI Generation failed:", err);
    if (err.message?.includes("Requested entity was not found") && window.aistudio) {
       window.aistudio.openSelectKey();
    }
  }
  return null;
};
