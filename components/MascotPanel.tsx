import React, { useState } from 'react';
import { eventBus } from '../store/runtime';
import { useEffect } from 'react';
import { contextStore } from '../store/runtime';

export const MascotPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"self" | "suggest">("self");
  const [question, setQuestion] = useState("");
  const [proposal, setProposal] = useState(contextStore.getState().agentState.mascot.lastProposal);
  const [suggestion, setSuggestion] = useState(contextStore.getState().agentState.mascot.lastSuggestion);

  useEffect(() => {
    const unsub = contextStore.subscribe(() => {
      const state = contextStore.getState();
      setProposal(state.agentState.mascot.lastProposal);
      setSuggestion(state.agentState.mascot.lastSuggestion);
    });
    return () => unsub();
  }, []);

  const triggerSelf = () => {
    if (!question.trim()) return;
    eventBus.emitType("MASCOT_CLICKED", { action: "start_from_my_question", userQuestion: question });
  };

  const triggerSuggest = () => {
    eventBus.emitType("MASCOT_CLICKED", { action: "suggest_puzzle" });
  };

  return (
    <div className="absolute right-6 bottom-32 z-40 pointer-events-auto">
      <button
        onClick={() => setOpen(o => !o)}
        className="px-4 py-2 bg-emerald-600 text-white rounded-full shadow hover:bg-emerald-700 transition"
      >
        {open ? "Hide Mascot" : "Open Mascot"}
      </button>

      {open && (
        <div className="mt-3 w-80 bg-white/95 border border-gray-200 rounded-2xl shadow-xl p-4 space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => setMode("self")}
              className={`px-3 py-1 rounded-lg text-sm font-semibold ${mode === "self" ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-700"}`}
            >
              Start from my question
            </button>
            <button
              onClick={() => setMode("suggest")}
              className={`px-3 py-1 rounded-lg text-sm font-semibold ${mode === "suggest" ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-700"}`}
            >
              Suggest for me
            </button>
          </div>

          {mode === "self" && (
            <div className="space-y-2">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm"
                placeholder="What are you stuck on?"
              />
              <button
                onClick={triggerSelf}
                className="w-full px-3 py-2 bg-emerald-600 text-white rounded-lg shadow hover:bg-emerald-700 transition text-sm font-semibold"
              >
                Ask Mascot
              </button>
              {proposal && (
                <div className="border border-emerald-100 bg-emerald-50 rounded-lg p-2 text-sm text-emerald-900 space-y-1">
                  <div className="font-bold">Proposal</div>
                  <div>{proposal.centralQuestion}</div>
                  <div className="text-[11px] uppercase font-semibold text-emerald-700">Modes: {proposal.primaryModes.join(", ")}</div>
                  <div className="text-[12px]">{proposal.rationale}</div>
                </div>
              )}
            </div>
          )}

          {mode === "suggest" && (
            <div className="space-y-2">
              <button
                onClick={triggerSuggest}
                className="w-full px-3 py-2 bg-emerald-600 text-white rounded-lg shadow hover:bg-emerald-700 transition text-sm font-semibold"
              >
                Suggest a puzzle
              </button>
              {suggestion && (
                <div className="border border-blue-100 bg-blue-50 rounded-lg p-2 text-sm text-blue-900 space-y-1">
                  <div className="font-bold">Suggestion</div>
                  {suggestion.shouldSuggest === false ? (
                    <div>No strong suggestion right now.</div>
                  ) : (
                    <>
                      <div>{suggestion.centralQuestion}</div>
                      <div className="text-[11px] uppercase font-semibold text-blue-700">Modes: {suggestion.primaryModes?.join(", ")}</div>
                      <div className="text-[12px]">{suggestion.rationale}</div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
