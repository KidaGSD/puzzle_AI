/**
 * Feature Extraction Agent
 *
 * Extracts structured features from fragments using Gemini's reasoning capability.
 * This enables grounded AI responses by providing specific, analyzed features
 * from the user's actual content.
 *
 * KEY DESIGN PRINCIPLE:
 * - NO hardcoded theme patterns or keyword dictionaries
 * - All feature extraction comes from Gemini's understanding
 * - Local fallback is MINIMAL (keyword extraction only, no fake "theme detection")
 */

import { Fragment, FragmentType } from "../../domain/models";
import { LLMClient, JsonSchema, ImageInput } from "../adkClient";

// ========== Feature Types ==========

export interface TextFeatures {
  keywords: string[];       // Key terms extracted by AI: "matcha", "zen", "awakening"
  entities: string[];       // Named entities: "Tea of Awakening", "Song dynasty"
  themes: string[];         // AI-detected themes: "tradition meets modern", "calm energy"
  sentiment: string;        // AI-detected sentiment: "calm", "energetic", "premium"
  descriptors: string[];    // Adjectives: "gentle", "warm", "clean"
  uniqueInsight: string;    // What makes this fragment unique/special
}

export interface ImageFeatures {
  colors: string[];         // AI-detected colors: "dusty green", "warm cream", "muted gold"
  objects: string[];        // AI-detected objects: "ceramic tea cup", "bamboo mat", "stone"
  composition: string;      // AI-detected layout: "centered minimalist", "asymmetric balance"
  mood: string;             // AI-detected mood: "calm contemplative", "vibrant energetic"
  style: string;            // AI-detected style: "modern japanese", "rustic organic"
  uniqueInsight: string;    // What makes this image unique/special
}

export interface FragmentFeatures {
  id: string;
  title: string;
  type: FragmentType;
  textFeatures?: TextFeatures;
  imageFeatures?: ImageFeatures;
  combinedKeywords: string[];   // Merged keywords for easy access
  uniqueInsight: string;        // The ONE thing that makes this fragment stand out
}

// ========== JSON Schemas for Gemini Structured Output ==========

/**
 * Schema for text feature extraction
 * Gemini will return JSON conforming to this structure
 */
const TEXT_FEATURES_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    keywords: {
      type: 'array',
      items: { type: 'string' },
      description: 'Key terms and concepts (3-8 words)',
    },
    entities: {
      type: 'array',
      items: { type: 'string' },
      description: 'Named entities, brand names, proper nouns (0-5)',
    },
    themes: {
      type: 'array',
      items: { type: 'string' },
      description: 'Abstract themes the content conveys (1-4 short phrases)',
    },
    sentiment: {
      type: 'string',
      description: 'Overall emotional tone: calm, energetic, premium, playful, serious, etc.',
    },
    descriptors: {
      type: 'array',
      items: { type: 'string' },
      description: 'Adjectives and descriptive words found (0-5)',
    },
    uniqueInsight: {
      type: 'string',
      description: 'ONE sentence: what makes this content unique or special',
    },
  },
  required: ['keywords', 'themes', 'sentiment', 'uniqueInsight'],
};

/**
 * Schema for image feature extraction (Vision)
 */
const IMAGE_FEATURES_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    colors: {
      type: 'array',
      items: { type: 'string' },
      description: 'Dominant colors with descriptors: "warm terracotta", "muted sage green"',
    },
    objects: {
      type: 'array',
      items: { type: 'string' },
      description: 'Objects visible in the image: "ceramic cup", "wooden table"',
    },
    composition: {
      type: 'string',
      description: 'How elements are arranged: "centered minimal", "asymmetric dynamic", "layered depth"',
    },
    mood: {
      type: 'string',
      description: 'Emotional quality: "calm contemplative", "vibrant energetic", "cozy intimate"',
    },
    style: {
      type: 'string',
      description: 'Visual style: "modern japanese", "scandinavian minimal", "rustic organic"',
    },
    uniqueInsight: {
      type: 'string',
      description: 'ONE sentence: what makes this image unique or special as design reference',
    },
  },
  required: ['colors', 'mood', 'style', 'uniqueInsight'],
};

// ========== Gemini-Powered Feature Extraction ==========

/**
 * Build the prompt for text feature extraction
 */
const buildTextExtractionPrompt = (content: string, title: string): string => {
  return `Analyze this fragment and extract structured features for a design thinking tool.

FRAGMENT TITLE: "${title}"
CONTENT:
"""
${content.slice(0, 2000)}
"""

TASK:
1. Extract KEY TERMS that capture the essence (not generic words)
2. Identify NAMED ENTITIES (brands, products, proper nouns)
3. Detect THEMES - what abstract concepts does this convey?
4. Determine SENTIMENT - the overall emotional tone
5. Find DESCRIPTORS - specific adjectives the author uses
6. Write ONE UNIQUE INSIGHT - what makes this fragment special?

IMPORTANT:
- Be SPECIFIC to this content, not generic
- The uniqueInsight should capture what's interesting about THIS fragment
- Themes should be short phrases that capture meaning, not single words`;
};

/**
 * Build the prompt for image analysis
 */
const buildImageAnalysisPrompt = (title: string): string => {
  return `Analyze this image for design inspiration features.

IMAGE TITLE: "${title}"

TASK:
1. Identify DOMINANT COLORS with descriptive names (not just "blue" but "dusty sky blue")
2. List visible OBJECTS in the image
3. Describe the COMPOSITION (how elements are arranged)
4. Detect the MOOD (emotional quality)
5. Identify the STYLE (design aesthetic)
6. Write ONE UNIQUE INSIGHT - what makes this image valuable as design reference?

IMPORTANT:
- Be SPECIFIC to what you see, not generic descriptions
- The uniqueInsight should explain why a designer would save this image
- Colors should have descriptive names that capture their quality`;
};

/**
 * Extract text features using Gemini structured output
 */
export const extractTextFeaturesWithGemini = async (
  content: string,
  title: string,
  client: LLMClient
): Promise<TextFeatures> => {
  try {
    const prompt = buildTextExtractionPrompt(content, title);
    const result = await client.generateStructured<TextFeatures>(
      prompt,
      TEXT_FEATURES_SCHEMA,
      0.4 // Lower temperature for more consistent extraction
    );

    console.log(`[FeatureExtraction] Extracted features for "${title}": ${result.themes.length} themes, ${result.keywords.length} keywords`);

    return {
      keywords: (result.keywords || []).slice(0, 8),
      entities: (result.entities || []).slice(0, 5),
      themes: (result.themes || []).slice(0, 4),
      sentiment: result.sentiment || "neutral",
      descriptors: (result.descriptors || []).slice(0, 5),
      uniqueInsight: result.uniqueInsight || "",
    };
  } catch (error) {
    console.warn("[FeatureExtraction] Gemini extraction failed, using local fallback:", error);
    return extractTextFeaturesLocal(content);
  }
};

/**
 * Extract image features using Gemini Vision
 */
export const extractImageFeaturesWithVision = async (
  imageUrl: string,
  title: string,
  client: LLMClient
): Promise<ImageFeatures> => {
  try {
    const prompt = buildImageAnalysisPrompt(title);

    // Determine MIME type from URL (best guess)
    const mimeType = imageUrl.toLowerCase().includes('.png') ? 'image/png'
      : imageUrl.toLowerCase().includes('.webp') ? 'image/webp'
      : 'image/jpeg';

    const images: ImageInput[] = [{
      url: imageUrl,
      mimeType,
    }];

    const result = await client.generateStructuredWithImages<ImageFeatures>(
      prompt,
      images,
      IMAGE_FEATURES_SCHEMA,
      0.4
    );

    console.log(`[FeatureExtraction] Vision analysis for "${title}": ${result.colors?.length || 0} colors, mood: ${result.mood}`);

    return {
      colors: (result.colors || []).slice(0, 6),
      objects: (result.objects || []).slice(0, 8),
      composition: result.composition || "balanced",
      mood: result.mood || "neutral",
      style: result.style || "modern",
      uniqueInsight: result.uniqueInsight || "",
    };
  } catch (error) {
    console.warn("[FeatureExtraction] Vision analysis failed, using metadata fallback:", error);
    return extractImageFeaturesFromMetadata(title, "");
  }
};

// ========== Local Fallback (Minimal - Keywords Only) ==========

/**
 * Common stop words to filter out
 */
const STOP_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
  "her", "was", "one", "our", "out", "has", "have", "been", "were", "they",
  "this", "that", "with", "from", "will", "would", "there", "their", "what",
  "about", "which", "when", "make", "like", "just", "over", "such", "into",
  "than", "them", "some", "could", "very", "more", "also", "how", "its",
  "being", "only", "other", "most", "then", "should", "these", "here",
]);

/**
 * Extract text features using simple keyword extraction ONLY
 * This is a MINIMAL fallback - no fake theme detection
 */
export const extractTextFeaturesLocal = (content: string): TextFeatures => {
  const words = content.toLowerCase().split(/\W+/).filter(w => w.length > 2);

  // Extract keywords by frequency (simple, honest approach)
  const wordFreq: Record<string, number> = {};
  words.forEach(w => {
    if (!STOP_WORDS.has(w) && w.length > 3) {
      wordFreq[w] = (wordFreq[w] || 0) + 1;
    }
  });

  const keywords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);

  // Extract entities (capitalized words in original text)
  const entityPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
  const entities = [...new Set(content.match(entityPattern) || [])].slice(0, 5);

  // NOTE: We do NOT attempt to detect themes, sentiment, or descriptors
  // without AI. This would be fake reasoning.
  return {
    keywords: [...new Set(keywords)],
    entities: [...new Set(entities)],
    themes: [],  // Empty - requires AI to detect
    sentiment: "unknown",  // Honest - we don't know without AI
    descriptors: [],  // Empty - requires AI to extract meaningfully
    uniqueInsight: "",  // Empty - requires AI reasoning
  };
};

/**
 * Extract basic image features from metadata only (when Vision unavailable)
 * This is a MINIMAL fallback - no fake analysis
 */
export const extractImageFeaturesFromMetadata = (
  title: string,
  _summary?: string  // Kept for API compatibility, not used in minimal fallback
): ImageFeatures => {
  // Only return what we ACTUALLY know from metadata
  // We intentionally don't try to "guess" features from title/summary
  return {
    colors: [],  // Empty - requires Vision to detect
    objects: [], // Empty - requires Vision to detect
    composition: "unknown",
    mood: "unknown",
    style: "unknown",
    uniqueInsight: title ? `Image: ${title}` : "Visual reference",
  };
};

// ========== Main Feature Extraction Pipeline ==========

/**
 * Extract features from a single fragment
 * Uses Gemini when available, minimal fallback otherwise
 */
export const extractFragmentFeatures = async (
  fragment: Fragment,
  client?: LLMClient
): Promise<FragmentFeatures> => {
  const isText = fragment.type === "TEXT" || fragment.type === "OTHER";
  const isImage = fragment.type === "IMAGE";

  let textFeatures: TextFeatures | undefined;
  let imageFeatures: ImageFeatures | undefined;
  let uniqueInsight = "";

  // ========== Text Fragment Processing ==========
  if (isText && fragment.content) {
    if (client && !client.isMock) {
      // Use Gemini for real feature extraction
      textFeatures = await extractTextFeaturesWithGemini(
        fragment.content,
        fragment.title || "Untitled",
        client
      );
      uniqueInsight = textFeatures.uniqueInsight;
    } else {
      // Minimal fallback - keywords only
      textFeatures = extractTextFeaturesLocal(fragment.content);
      uniqueInsight = fragment.title ? `Text: ${fragment.title}` : "Text fragment";
    }
  }

  // ========== Image Fragment Processing ==========
  if (isImage) {
    // For IMAGE fragments, content holds the image URL
    const imageUrl = fragment.content;

    if (client && !client.isMock && imageUrl) {
      // Use Gemini Vision for real image analysis
      imageFeatures = await extractImageFeaturesWithVision(
        imageUrl,
        fragment.title || "Image",
        client
      );
      uniqueInsight = imageFeatures.uniqueInsight;
    } else {
      // Minimal fallback - metadata only
      imageFeatures = extractImageFeaturesFromMetadata(
        fragment.title || "",
        fragment.summary || ""
      );
      uniqueInsight = fragment.title ? `Image: ${fragment.title}` : "Visual reference";
    }
  }

  // ========== Combine Keywords ==========
  const combinedKeywords = [
    ...(textFeatures?.keywords || []),
    ...(textFeatures?.entities || []),
    ...(textFeatures?.themes || []),
    ...(imageFeatures?.colors || []),
    ...(imageFeatures?.objects || []),
  ];

  return {
    id: fragment.id,
    title: fragment.title || "Untitled",
    type: fragment.type,
    textFeatures,
    imageFeatures,
    combinedKeywords: [...new Set(combinedKeywords)].slice(0, 15),
    uniqueInsight,
  };
};

/**
 * Extract features from multiple fragments in batch
 */
export const extractBatchFeatures = async (
  fragments: Fragment[],
  client?: LLMClient
): Promise<FragmentFeatures[]> => {
  // Process sequentially to avoid rate limits on Vision API
  const results: FragmentFeatures[] = [];
  for (const f of fragments) {
    const features = await extractFragmentFeatures(f, client);
    results.push(features);
  }
  return results;
};

/**
 * Summarize all fragment features into a compact context string
 * for use in prompts
 */
export const summarizeFeatures = (features: FragmentFeatures[]): string => {
  // Collect unique insights
  const insights = features
    .map(f => f.uniqueInsight)
    .filter(i => i && i.length > 0);

  // Collect all keywords by frequency
  const allKeywords = features.flatMap(f => f.combinedKeywords);
  const keywordCounts: Record<string, number> = {};
  allKeywords.forEach(k => {
    keywordCounts[k] = (keywordCounts[k] || 0) + 1;
  });

  const topKeywords = Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k]) => k);

  // Collect themes
  const themes = [...new Set(features.flatMap(f => f.textFeatures?.themes || []))];

  // Collect moods/sentiments
  const sentiments = features
    .map(f => f.textFeatures?.sentiment || f.imageFeatures?.mood)
    .filter(s => s && s !== "unknown" && s !== "neutral");

  return `Key Concepts: ${topKeywords.join(", ") || "none extracted"}
Themes: ${themes.join(", ") || "requires AI analysis"}
Mood/Sentiment: ${[...new Set(sentiments)].join(", ") || "unknown"}
${insights.length > 0 ? `\nUnique Aspects:\n${insights.map(i => `  - ${i}`).join("\n")}` : ""}`;
};
