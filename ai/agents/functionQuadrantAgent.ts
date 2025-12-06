/**
 * FUNCTION Quadrant Agent
 *
 * Focus: Purpose, utility, user value, practical constraints
 * Aspects: primary use case, target audience, accessibility, platform, constraints
 */

import { QuadrantAgentInput, QuadrantAgentOutput } from "../../domain/models";
import { LLMClient } from "../adkClient";
import { runQuadrantAgentWithTimeout } from "./baseQuadrantAgent";

export const runFunctionQuadrantAgent = async (
  input: Omit<QuadrantAgentInput, "mode">,
  client: LLMClient,
  timeoutMs: number = 15000
): Promise<QuadrantAgentOutput> => {
  const fullInput: QuadrantAgentInput = {
    ...input,
    mode: "FUNCTION",
  };

  console.log(`[FunctionQuadrantAgent] Generating ${input.requested_count} pieces for FUNCTION quadrant`);
  return runQuadrantAgentWithTimeout(fullInput, client, timeoutMs);
};
