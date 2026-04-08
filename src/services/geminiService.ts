import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function sendMessage(message: string, history: { role: string, parts: { text: string }[] }[] = []) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...history,
        { role: "user", parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: "Anda adalah asisten akademik cerdas untuk platform BimTEKs.ID. Bantu pengguna dengan pertanyaan seputar penulisan ilmiah, penelitian, dan tugas akademik lainnya. Gunakan bahasa Indonesia yang sopan, profesional, dan mudah dimengerti.",
      }
    });

    return response.text;
  } catch (error) {
    console.error("Error sending message to Gemini:", error);
    throw error;
  }
}
