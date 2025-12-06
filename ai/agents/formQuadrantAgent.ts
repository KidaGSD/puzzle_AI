/**
 * FORM Quadrant Agent
 *
 * Focus: Visual structure, shape, composition, spatial relationships
 * Aspects: geometric vs organic, visual weight, layering, proportion, texture
 */

import { QuadrantAgentInput, QuadrantAgentOutput } from "../../domain/models";
import { LLMClient } from "../adkClient";
import { runQuadrantAgentWithTimeout } from "./baseQuadrantAgent";

export const runFormQuadrantAgent = async (
  input: Omit<QuadrantAgentInput, "mode">,
  client: LLMClient,
  timeoutMs: number = 15000
): Promise<QuadrantAgentOutput> => {
  const fullInput: QuadrantAgentInput = {
    ...input,
    mode: "FORM",
  };

  console.log(`[FormQuadrantAgent] Generating ${input.requested_count} pieces for FORM quadrant`);
  return runQuadrantAgentWithTimeout(fullInput, client, timeoutMs);
};
