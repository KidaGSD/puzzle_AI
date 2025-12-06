import { GoogleGenAI } from "@google/genai";

/**
 * Image input for multimodal generation
 */
export interface ImageInput {
  /** Image URL (will be fetched and converted to base64) */
  url?: string;
  /** Base64 encoded image data (alternative to URL) */
  base64Data?: string;
  /** MIME type (image/png, image/jpeg, image/webp, image/heic, image/heif) */
  mimeType: string;
}

/**
 * JSON Schema type for structured output
 * See: https://ai.google.dev/gemini-api/docs/structured-output
 */
export interface JsonSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean';
  properties?: Record<string, JsonSchema & { description?: string }>;
  items?: JsonSchema;
  required?: string[];
  enum?: string[];
  description?: string;
  additionalProperties?: boolean;
}

/**
 * Model tier for different task complexities
 */
export type ModelTier = 'flash' | 'pro';

/**
 * LLM Client interface with text, multimodal, and structured output support
 */
export interface LLMClient {
  /** Generate text response from text prompt */
  generate(prompt: string, temperature?: number): Promise<string>;
  /** Generate text response from text + images (VLM) */
  generateWithImages(
    prompt: string,
    images: ImageInput[],
    temperature?: number
  ): Promise<string>;
  /**
   * Generate structured JSON response with guaranteed schema conformance
   * Uses Gemini's built-in JSON mode for reliable parsing
   */
  generateStructured<T>(
    prompt: string,
    schema: JsonSchema,
    temperature?: number
  ): Promise<T>;
  /**
   * Generate structured JSON response from text + images (VLM)
   * Combines vision analysis with structured output
   */
  generateStructuredWithImages<T>(
    prompt: string,
    images: ImageInput[],
    schema: JsonSchema,
    temperature?: number
  ): Promise<T>;
  /** Whether this is a mock client (no API key) */
  readonly isMock: boolean;
  /** The model being used */
  readonly model: string;
  /** The model tier (flash or pro) */
  readonly tier: ModelTier;
}

// Vite/browser-safe env resolution
const env = (typeof import.meta !== "undefined" && (import.meta as any).env) || {};

/**
 * Gemini Model Configuration
 *
 * Available models (as of Dec 2024):
 * - gemini-2.5-flash: Fast, efficient, good for most tasks (RECOMMENDED for speed)
 * - gemini-2.5-pro: Best quality, complex reasoning (use sparingly)
 *
 * Rate limits (free tier):
 * - Flash: 15 RPM, 1M TPM, 1500 RPD
 * - Pro: 2 RPM, 32K TPM, 50 RPD
 */
const MODELS = {
  flash: 'gemini-2.5-flash',
  pro: 'gemini-2.5-pro',
} as const;

const apiKey =
  env.VITE_GEMINI_API_KEY ||
  env.GEMINI_API_KEY ||
  (typeof process !== "undefined" ? process.env.GEMINI_API_KEY || process.env.API_KEY : "");

/**
 * Default temperature - 0.7 for balanced creativity/consistency
 */
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Retry configuration
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

const cleanText = (text?: string | null) => (text || "").trim();

/**
 * Sleep helper for retry delays
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  context: string,
  maxRetries = RETRY_CONFIG.maxRetries
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if it's a rate limit error (429)
      const isRateLimit = error?.message?.includes('429') ||
                          error?.message?.includes('RESOURCE_EXHAUSTED') ||
                          error?.message?.includes('quota');

      // Check if it's a retryable error
      const isRetryable = isRateLimit ||
                          error?.message?.includes('500') ||
                          error?.message?.includes('503');

      if (!isRetryable || attempt === maxRetries) {
        console.error(`[adkClient] ${context} failed after ${attempt + 1} attempts:`, error?.message);
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt),
        RETRY_CONFIG.maxDelayMs
      );

      // Add jitter for rate limits
      const jitter = isRateLimit ? Math.random() * 2000 : 0;
      const totalDelay = delay + jitter;

      console.warn(`[adkClient] ${context} failed (attempt ${attempt + 1}), retrying in ${Math.round(totalDelay)}ms...`);
      await sleep(totalDelay);
    }
  }

  throw lastError;
}

/**
 * Fetch image from URL and convert to base64
 */
async function fetchImageAsBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    // Browser-compatible base64 encoding
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (error) {
    console.error(`[adkClient] Failed to fetch image from ${url}:`, error);
    throw error;
  }
}

const makeMockClient = (tier: ModelTier = 'flash'): LLMClient => ({
  isMock: true,
  model: "mock",
  tier,
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
      // Return STATEMENTS, not questions
      return JSON.stringify({
        pieces: [
          { mode: "EXPRESSION", text: "Calm confidence over excitement" },
          { mode: "EXPRESSION", text: "Professional warmth balanced with clarity" },
        ],
      });
    }
    return "{}";
  },
  async generateWithImages(prompt: string, images: ImageInput[]) {
    // Mock VLM: return a description based on image count
    const imageCount = images.length;
    if (imageCount === 0) {
      return this.generate(prompt);
    }
    return JSON.stringify({
      description: `Mock description for ${imageCount} image(s)`,
      elements: ["mock element 1", "mock element 2"],
      mood: "neutral",
      colors: ["gray", "white"],
    });
  },
  async generateStructured<T>(prompt: string, schema: JsonSchema): Promise<T> {
    // Mock structured output - return empty object matching expected shape
    const mockResultPromise = this.generate(prompt);
    try {
      const mockResult = await mockResultPromise;
      return JSON.parse(mockResult) as T;
    } catch {
      // Return minimal valid structure based on schema type
      if (schema.type === 'object') {
        return {} as T;
      }
      if (schema.type === 'array') {
        return [] as unknown as T;
      }
      return null as unknown as T;
    }
  },
  async generateStructuredWithImages<T>(
    prompt: string,
    images: ImageInput[],
    schema: JsonSchema
  ): Promise<T> {
    // Mock structured VLM output
    const mockResultPromise = this.generateWithImages(prompt, images);
    try {
      const mockResult = await mockResultPromise;
      return JSON.parse(mockResult) as T;
    } catch {
      if (schema.type === 'object') {
        return {} as T;
      }
      if (schema.type === 'array') {
        return [] as unknown as T;
      }
      return null as unknown as T;
    }
  },
});

/**
 * Create an LLM client with a specific model tier
 *
 * @param tier - 'flash' for fast/cheap tasks, 'pro' for complex reasoning
 */
export const createLLMClient = (tier: ModelTier = 'flash'): LLMClient => {
  if (!apiKey) {
    console.warn('[adkClient] No API key found, using mock client');
    return makeMockClient(tier);
  }

  const model = MODELS[tier];
  console.log(`[adkClient] Initializing ${tier} client with model: ${model}`);
  const genAI = new GoogleGenAI({ apiKey });

  return {
    isMock: false,
    model,
    tier,

    /**
     * Generate text response from text-only prompt
     */
    async generate(prompt: string, temperature = DEFAULT_TEMPERATURE) {
      return withRetry(async () => {
        const res = await genAI.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature,
          },
        });
        return cleanText(res.text);
      }, `generate(${tier})`);
    },

    /**
     * Generate text response from text + images (Vision Language Model)
     */
    async generateWithImages(
      prompt: string,
      images: ImageInput[],
      temperature = DEFAULT_TEMPERATURE
    ): Promise<string> {
      if (images.length === 0) {
        return this.generate(prompt, temperature);
      }

      return withRetry(async () => {
        // Build multimodal content parts
        const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
        parts.push({ text: prompt });

        // Add each image
        for (const img of images) {
          let base64Data: string;

          if (img.base64Data) {
            base64Data = img.base64Data;
          } else if (img.url) {
            try {
              base64Data = await fetchImageAsBase64(img.url);
            } catch (error) {
              console.error(`[adkClient] Skipping image due to fetch error: ${img.url}`);
              continue;
            }
          } else {
            console.warn('[adkClient] Image input missing both url and base64Data, skipping');
            continue;
          }

          parts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: base64Data,
            },
          });
        }

        // If all images failed, fall back to text-only
        if (parts.length === 1) {
          console.warn('[adkClient] All images failed to load, falling back to text-only');
          const res = await genAI.models.generateContent({
            model,
            contents: prompt,
            config: { temperature },
          });
          return cleanText(res.text);
        }

        console.log(`[adkClient] Generating with ${parts.length - 1} image(s) using ${tier}`);

        const res = await genAI.models.generateContent({
          model,
          contents: parts,
          config: {
            temperature,
          },
        });

        return cleanText(res.text);
      }, `generateWithImages(${tier})`);
    },

    /**
     * Generate structured JSON response with guaranteed schema conformance
     */
    async generateStructured<T>(
      prompt: string,
      schema: JsonSchema,
      temperature = DEFAULT_TEMPERATURE
    ): Promise<T> {
      return withRetry(async () => {
        console.log(`[adkClient] Generating structured output (${tier}) with schema type: ${schema.type}`);

        const res = await genAI.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature,
            responseMimeType: "application/json",
            responseSchema: schema as any,
          },
        });

        const text = cleanText(res.text);
        try {
          return JSON.parse(text) as T;
        } catch (error) {
          console.error('[adkClient] Failed to parse structured output:', text);
          throw new Error(`Structured output parsing failed: ${error}`);
        }
      }, `generateStructured(${tier})`);
    },

    /**
     * Generate structured JSON response from text + images (VLM)
     */
    async generateStructuredWithImages<T>(
      prompt: string,
      images: ImageInput[],
      schema: JsonSchema,
      temperature = DEFAULT_TEMPERATURE
    ): Promise<T> {
      if (images.length === 0) {
        return this.generateStructured(prompt, schema, temperature) as Promise<T>;
      }

      return withRetry(async () => {
        // Build multimodal content parts
        const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
        parts.push({ text: prompt });

        // Add each image
        for (const img of images) {
          let base64Data: string;

          if (img.base64Data) {
            base64Data = img.base64Data;
          } else if (img.url) {
            try {
              base64Data = await fetchImageAsBase64(img.url);
            } catch (error) {
              console.error(`[adkClient] Skipping image due to fetch error: ${img.url}`);
              continue;
            }
          } else {
            console.warn('[adkClient] Image input missing both url and base64Data, skipping');
            continue;
          }

          parts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: base64Data,
            },
          });
        }

        // If all images failed, fall back to text-only structured
        if (parts.length === 1) {
          console.warn('[adkClient] All images failed to load, falling back to text-only structured');
          const res = await genAI.models.generateContent({
            model,
            contents: prompt,
            config: {
              temperature,
              responseMimeType: "application/json",
              responseSchema: schema as any,
            },
          });
          const text = cleanText(res.text);
          return JSON.parse(text) as T;
        }

        console.log(`[adkClient] Generating structured output with ${parts.length - 1} image(s) using ${tier}`);

        const res = await genAI.models.generateContent({
          model,
          contents: parts,
          config: {
            temperature,
            responseMimeType: "application/json",
            responseSchema: schema as any,
          },
        });

        const text = cleanText(res.text);
        try {
          return JSON.parse(text) as T;
        } catch (error) {
          console.error('[adkClient] Failed to parse structured VLM output:', text);
          throw new Error(`Structured VLM output parsing failed: ${error}`);
        }
      }, `generateStructuredWithImages(${tier})`);
    },
  };
};

/**
 * Convenience functions to create clients for different tiers
 */
export const createFlashClient = () => createLLMClient('flash');
export const createProClient = () => createLLMClient('pro');

/**
 * Default client (flash for speed)
 */
export const defaultClient = createLLMClient('flash');
