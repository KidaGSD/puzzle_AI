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

const fallbackSummarize = (f: Fragment) => {
  const text = f.content || "";
  const summary = text.length > 80 ? `${text.slice(0, 77)}...` : text || "Untitled fragment";
  // Generate a short title from first few words
  const words = text.trim().split(/\s+/).slice(0, 4);
  const title = words.length > 0 ? words.join(" ") : "Untitled";
  const tags = text
    .toLowerCase()
    .split(/\W+/)
    .filter(Boolean)
    .slice(0, 3);
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
    return parsed;
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
