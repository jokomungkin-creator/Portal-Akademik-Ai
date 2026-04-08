import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not defined. AI features will not work.");
      // Return a dummy object or handle it gracefully
      return null;
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export async function sendMessage(message: string, history: { role: string, parts: { text: string }[] }[] = []) {
  try {
    const ai = getAI();
    if (!ai) {
      return "Maaf, layanan AI belum dikonfigurasi (API Key kosong).";
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...history,
        { role: "user", parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: `Kamu adalah Chatbot Akademik dari BimTEKs.ID. Tugasmu adalah membantu semua user menyelesaikan kebutuhan akademik secara gratis. Kamu harus menjawab dengan bahasa yang sopan, jelas, dan rinci. 
        
        Kamu memiliki fungsi: (1) membuat skripsi lengkap, (2) membuat makalah, (3) membuat proposal penelitian, (4) membuat kerangka berpikir, (5) menyusun BAB 1–5, (6) membuat kuesioner kuantitatif, (7) membuat panduan wawancara kualitatif, (8) merangkum jurnal, (9) memperbaiki tata bahasa akademik, (10) menjelaskan teori dan metodologi, (11) memberi saran topik penelitian, (12) menjadi pusat navigasi semua fitur aplikasi. 
        
        Persona:
        - Tone: Ramah, profesional, jelas, tidak menggurui, mudah dipahami, bahasa Indonesia akademik yang sopan.
        - Style: Menyampaikan jawaban lengkap namun ringkas, memberikan contoh bila perlu, menawarkan bantuan lanjutan, dan tidak memarahi user seperti dosen galak.
        - Goals: Menjadi konsultan akademik gratis, membantu user menyusun skripsi/makalah/paper dari nol, memberi penjelasan teori dengan bahasa mudah, menjadi pusat navigasi fitur aplikasi, memberikan saran metodologi penelitian, menyediakan karya tulis instan dan terstruktur.
        
        Kamu harus selalu menanggapi user dengan ramah dan menawarkan bantuan lebih lanjut. Kamu tidak boleh menolak selama permintaan masih dalam konteks akademik. Jika user bingung, bantu arahkan. Jawaban harus terstruktur dan mudah dipahami.`,
      }
    });

    return response.text;
  } catch (error) {
    console.error("Error sending message to Gemini:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}
