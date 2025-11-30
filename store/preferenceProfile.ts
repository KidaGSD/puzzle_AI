import {
  DesignMode,
  PieceEvent,
  PuzzlePiece,
  PuzzlePieceCategory,
  PreferenceStats,
  UserPreferenceProfile,
} from "../domain/models";

type PieceCategoryKey = PuzzlePieceCategory | "CONNECT";

const emptyStats = (): PreferenceStats => ({
  suggested: 0,
  placed: 0,
  edited: 0,
  discarded: 0,
  connected: 0,
});

export const makePreferenceKey = (
  mode: DesignMode,
  category: PieceCategoryKey,
): string => `${mode}:${category}`;

export const aggregatePreferenceProfile = (
  events: PieceEvent[],
  pieces: PuzzlePiece[],
): UserPreferenceProfile => {
  const profile: UserPreferenceProfile = {};
  const pieceIndex = new Map<string, PuzzlePiece>();
  pieces.forEach(p => pieceIndex.set(p.id, p));

  events.forEach(event => {
    const piece = pieceIndex.get(event.pieceId);
    if (!piece) return;
    const key = makePreferenceKey(piece.mode, piece.category as PieceCategoryKey);
    const stats = profile[key] ?? emptyStats();

    switch (event.type) {
      case "CREATE_SUGGESTED":
        stats.suggested += 1;
        break;
      case "CREATE_USER":
        stats.suggested += 1;
        break;
      case "PLACE":
        stats.placed += 1;
        break;
      case "EDIT_TEXT":
        stats.edited += 1;
        break;
      case "DELETE":
        stats.discarded += 1;
        break;
      case "ATTACH_TO_ANCHOR":
        stats.connected += 1;
        break;
      case "DETACH_FROM_ANCHOR":
        break;
      default:
        break;
    }

    profile[key] = stats;
  });

  return profile;
};

export const buildPreferenceHints = (
  profile: UserPreferenceProfile,
  limit = 2,
): string => {
  const hints: string[] = [];

  const entries = Object.entries(profile).sort(([, a], [, b]) => {
    const scoreA = a.placed + a.connected - a.discarded;
    const scoreB = b.placed + b.connected - b.discarded;
    return scoreB - scoreA;
  });

  entries.slice(0, limit).forEach(([key, stats]) => {
    const [mode, category] = key.split(":");
    const total = stats.suggested || 1;
    const discardRate = stats.discarded / total;
    if (discardRate > 0.5) {
      hints.push(`User often discards ${mode}-${category} prompts; keep them short and concrete.`);
    } else if (stats.connected > stats.placed) {
      hints.push(`User tends to attach ${mode}-${category} prompts to anchors; offer connect-ready phrasing.`);
    } else if (stats.edited > stats.placed) {
      hints.push(`User frequently edits ${mode}-${category}; propose concise drafts for quick tweaking.`);
    }
  });

  return hints.join(" ");
};
