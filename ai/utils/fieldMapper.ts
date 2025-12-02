/**
 * Field Mapper Utility
 *
 * Maps snake_case fields from AI agent outputs to camelCase for internal use.
 * AI/LLM outputs typically use snake_case, while our TypeScript interfaces use camelCase.
 *
 * Convention:
 * - Agent prompts can request snake_case (LLM preference)
 * - Map to camelCase immediately after parsing
 * - All internal interfaces use camelCase
 */

import { QuadrantAgentPiece, SaturationLevel, PiecePriority } from '../../domain/models';

/**
 * Raw piece output from AI agent (snake_case)
 */
interface RawAgentPiece {
  text: string;
  priority: number;
  saturation_level?: string;
  fragment_id?: string;
  fragment_title?: string;
  fragment_summary?: string;
  image_url?: string;
}

/**
 * Map a single raw agent piece to our internal interface
 */
export function mapAgentPieceToInterface(raw: RawAgentPiece): QuadrantAgentPiece {
  return {
    text: raw.text,
    priority: raw.priority as PiecePriority,
    saturation_level: (raw.saturation_level || 'medium') as SaturationLevel,
    fragment_id: raw.fragment_id,
    fragment_title: raw.fragment_title,
    fragment_summary: raw.fragment_summary,
    image_url: raw.image_url,
  };
}

/**
 * Map an array of raw agent pieces to our internal interface
 */
export function mapAgentPiecesToInterface(rawPieces: RawAgentPiece[]): QuadrantAgentPiece[] {
  return rawPieces.map(mapAgentPieceToInterface);
}

/**
 * Generic snake_case to camelCase converter
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert all keys in an object from snake_case to camelCase
 */
export function convertKeysToCamelCase<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const camelKey = snakeToCamel(key);

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[camelKey] = convertKeysToCamelCase(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[camelKey] = value.map(item =>
        typeof item === 'object' && item !== null
          ? convertKeysToCamelCase(item as Record<string, unknown>)
          : item
      );
    } else {
      result[camelKey] = value;
    }
  }

  return result;
}

/**
 * Map raw MascotSuggest output to our internal interface
 */
interface RawMascotSuggest {
  should_suggest?: boolean;
  central_question?: string;
  puzzle_type?: string;
  primary_modes?: string[];
  rationale?: string;
}

export interface MascotSuggestResult {
  shouldSuggest: boolean;
  centralQuestion?: string;
  puzzleType?: string;
  primaryModes?: string[];
  rationale?: string;
}

export function mapMascotSuggestToInterface(raw: RawMascotSuggest): MascotSuggestResult {
  return {
    shouldSuggest: raw.should_suggest ?? false,
    centralQuestion: raw.central_question,
    puzzleType: raw.puzzle_type,
    primaryModes: raw.primary_modes,
    rationale: raw.rationale,
  };
}
