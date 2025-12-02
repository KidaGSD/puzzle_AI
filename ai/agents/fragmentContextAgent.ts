import { Cluster, Fragment } from "../../domain/models";
import { LLMClient } from "../adkClient";

export interface FragmentContextInput {
  processAim: string;
  fragments: Array<{
    id: string;
    type: string;
    content: string;
    summary?: string;
    tags?: string[];
  }>;
  existingClusters: Cluster[];
}

export interface FragmentContextOutput {
  fragments: Array<{
    id: string;
    title: string;    // Short title (2-5 words)
    summary: string;  // 1-2 sentence summary
    tags: string[];
  }>;
  clusters?: Cluster[];
}

/**
 * Validate that a tag is meaningful (not a file extension, path segment, or hash)
 */
const isValidTag = (tag: string): boolean => {
  // Reject common file extensions
  if (/^(png|jpg|jpeg|gif|webp|pdf|svg|ico|bmp|tiff?)$/i.test(tag)) return false;
  // Reject path-like strings
  if (tag.includes('/') || tag.includes('\\')) return false;
  // Reject pure numbers or hex hashes (32+ chars or pure numbers)
  if (/^[0-9]+$/.test(tag)) return false;
  if (/^[0-9a-f]+$/i.test(tag) && tag.length >= 6) return false;
  // Reject very short tags (less than 2 chars)
  if (tag.length < 2) return false;
  // Reject common path segments
  if (/^(mockupfragments|fragments|images|assets|uploads)$/i.test(tag)) return false;
  // Reject URLs
  if (tag.includes('http') || tag.includes('www')) return false;
  return true;
};

const fallbackSummarize = (f: Fragment) => {
  const text = f.content || "";

  // Don't use file path content for text generation
  const isFilePath = text.startsWith('/') || text.includes('.png') || text.includes('.jpg');
  const textContent = isFilePath ? "" : text;

  const summary = textContent.length > 80
    ? `${textContent.slice(0, 77)}...`
    : textContent || (f.type === 'IMAGE' ? "Visual reference image" : "Untitled fragment");

  // Generate a short title from first few words
  const words = textContent.trim().split(/\s+/).slice(0, 4);
  const title = words.length > 0 && words[0]
    ? words.join(" ")
    : (f.type === 'IMAGE' ? "Image Reference" : "Untitled");

  // Generate tags with validation
  const rawTags = textContent
    .toLowerCase()
    .split(/\W+/)
    .filter(Boolean)
    .filter(w => w.length > 3) // Minimum word length
    .filter(isValidTag); // Apply validation

  const tags = rawTags.slice(0, 3);

  return { title, summary, tags: tags.length ? tags : ["idea"] };
};

const buildPrompt = (input: FragmentContextInput) => {
  const items = input.fragments
    .map(f => `- (${f.id}) [${f.type}] ${f.content}`)
    .join("\n");
  return `You are the Fragment & Context Agent.
Process Aim: ${input.processAim}

Fragments:
${items}

For each fragment, generate:
1. title: A short, memorable title (2-5 words) that captures the essence
2. summary: A 1-2 sentence summary of the content
3. tags: 2-4 relevant keywords

Return JSON with:
{
  "fragments": [{ "id": string, "title": string, "summary": string, "tags": [string] }],
  "clusters": [{ "id": string, "fragmentIds": [string], "theme": string }]
}
Only include clusters if clear themes exist.`;
};

export const runFragmentContextAgent = async (
  input: FragmentContextInput,
  client: LLMClient,
  fallbackFragments: Fragment[],
): Promise<FragmentContextOutput> => {
  try {
    const prompt = buildPrompt(input);
    const raw = await client.generate(prompt, 0.4);
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed.fragments) throw new Error("missing fragments");

    // Validate and filter tags from AI response
    const validatedFragments = parsed.fragments.map((f: { id: string; title: string; summary: string; tags: string[] }) => ({
      ...f,
      tags: (f.tags || []).filter(isValidTag).slice(0, 4), // Filter invalid tags
    }));

    return {
      ...parsed,
      fragments: validatedFragments,
    };
  } catch (err) {
    // Fallback heuristic on local fragments
    return {
      fragments: fallbackFragments.map(f => ({
        id: f.id,
        ...fallbackSummarize(f),
      })),
      clusters: fallbackFragments.length > 1
        ? [
            {
              id: "cluster-heuristic",
              fragmentIds: fallbackFragments.map(f => f.id),
              theme: "emerging-theme",
            },
          ]
        : [],
    };
  }
};
