/**
 * MOTION Quadrant Agent
 *
 * Focus: Movement, animation, transitions, rhythm, timing
 * Aspects: speed & pacing, easing curves, entrance/exit, micro-interactions, flow
 */

import { QuadrantAgentInput, QuadrantAgentOutput } from "../../domain/models";
import { LLMClient } from "../adkClient";
import { runQuadrantAgentWithTimeout } from "./baseQuadrantAgent";

export const runMotionQuadrantAgent = async (
  input: Omit<QuadrantAgentInput, "mode">,
  client: LLMClient,
  timeoutMs: number = 15000
): Promise<QuadrantAgentOutput> => {
  const fullInput: QuadrantAgentInput = {
    ...input,
    mode: "MOTION",
  };

  console.log(`[MotionQuadrantAgent] Generating ${input.requested_count} pieces for MOTION quadrant`);
  return runQuadrantAgentWithTimeout(fullInput, client, timeoutMs);
};
