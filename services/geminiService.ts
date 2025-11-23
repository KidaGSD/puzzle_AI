import { GoogleGenAI } from "@google/genai";
import { FragmentData } from "../types";

// Safe initialization
const apiKey = process.env.API_KEY || ''; 
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

export const analyzeBoard = async (fragments: FragmentData[], aim: string): Promise<string> => {
  if (!ai) {
    console.warn("Gemini API Key not found");
    return "API Key Missing";
  }

  try {
    const context = fragments.map(f => {
      if (f.type === 'TEXT') return `Note: ${f.content}`;
      if (f.type === 'IMAGE') return `Image: ${f.title || 'Untitled Image'}`;
      return `Fragment: ${f.content}`;
    }).join('\n');

    const prompt = `
      You are a creative director assistant.
      The project aim is: "${aim}".
      
      Here are the current fragments on the board:
      ${context}

      Identify 1 interesting "Lever" or "Direction" that emerges from these fragments. 
      Return ONLY a short JSON string with: { "name": "Creative Title", "reason": "Short reason why" }.
      Do not include markdown code blocks.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "";
  }
};
