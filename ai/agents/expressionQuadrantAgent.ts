/**
 * EXPRESSION Quadrant Agent
 *
 * Focus: Emotional tone, personality, brand voice, atmosphere
 * Aspects: mood, voice & tone, warmth vs cool, premium vs accessible, energy level
 */

import { QuadrantAgentInput, QuadrantAgentOutput } from "../../domain/models";
import { LLMClient } from "../adkClient";
import { runQuadrantAgentWithTimeout } from "./baseQuadrantAgent";

export const runExpressionQuadrantAgent = async (
  input: Omit<QuadrantAgentInput, "mode">,
  client: LLMClient,
  timeoutMs: number = 15000
): Promise<QuadrantAgentOutput> => {
  const fullInput: QuadrantAgentInput = {
    ...input,
    mode: "EXPRESSION",
  };

  console.log(`[ExpressionQuadrantAgent] Generating ${input.requested_count} pieces for EXPRESSION quadrant`);
  return runQuadrantAgentWithTimeout(fullInput, client, timeoutMs);
};
