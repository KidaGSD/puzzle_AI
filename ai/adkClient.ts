import { GoogleGenAI } from "@google/genai";

export interface LLMClient {
  generate(prompt: string, temperature?: number): Promise<string>;
  readonly isMock: boolean;
}

// Vite/browser-safe env resolution
const env = (typeof import.meta !== "undefined" && (import.meta as any).env) || {};
// Use Gemini 2.5 Pro for better reasoning, or 3.0 preview via env override
const defaultModel =
  env.VITE_GEMINI_MODEL ||
  env.GEMINI_MODEL ||
  (typeof process !== "undefined" ? process.env.GEMINI_MODEL : "") ||
  "gemini-2.5-pro";  // Upgraded from gemini-2.0-flash for better quality
const apiKey =
  env.VITE_GEMINI_API_KEY ||
  env.GEMINI_API_KEY ||
  (typeof process !== "undefined" ? process.env.GEMINI_API_KEY || process.env.API_KEY : "");

const cleanText = (text?: string | null) => (text || "").trim();

const makeMockClient = (): LLMClient => ({
  isMock: true,
  async generate(prompt: string) {
    // Lightweight mock: echo a JSON-ish hint for agent parsers.
    if (prompt.includes("Fragment & Context Agent")) {
      return JSON.stringify({
        fragments: [],
        clusters: [],
      });
    }
    if (prompt.includes("Mascot Agent")) {
      return JSON.stringify({
        centralQuestion: "What is the core feeling we want to preserve?",
        primaryModes: ["EXPRESSION"],
        rationale: "User brief mentions analog warmth; clarify feeling first.",
      });
    }
    if (prompt.includes("Puzzle Designer Agent") && prompt.includes("task: \"summarize\"")) {
      return JSON.stringify({
        directionStatement: "Analog-warm direction with calm motion.",
        reasons: ["Process aim favors analog warmth", "Fragments lean retro", "Motion should stay calm"],
        openQuestions: ["Confirm channel and audience"],
      });
    }
    if (prompt.includes("Puzzle Designer Agent")) {
      return JSON.stringify({
        centralQuestion: "How do we keep analog warmth without losing clarity?",
        anchors: { starting: "Analog warmth as the emotional hook", solution: "" },
        seedPieces: [],
      });
    }
    if (prompt.includes("Quadrant Piece Agent")) {
      // Return STATEMENTS (陈述式), not questions
      return JSON.stringify({
        pieces: [
          { mode: "EXPRESSION", text: "Calm confidence over excitement" },
          { mode: "EXPRESSION", text: "Professional warmth balanced with clarity" },
        ],
      });
    }
    return "{}";
  },
});

export const createLLMClient = (): LLMClient => {
  if (!apiKey) return makeMockClient();
  const genAI = new GoogleGenAI({ apiKey });
  return {
    isMock: false,
    async generate(prompt: string, temperature = 0.6) {
      const res = await genAI.models.generateContent({
        model: defaultModel,
        contents: prompt,
        config: {
          temperature,
        },
      });
      return cleanText(res.text);
    },
  };
};
