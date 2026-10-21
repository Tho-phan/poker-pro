"use client";

import { useState } from "react";
import type { LegalActions, PlayerAction } from "@/lib/protocol";

interface ActionBarProps {
  legal: LegalActions;
  onAct: (action: PlayerAction) => void;
}

/** Round to an integer chip count and clamp into [min, max]; never returns NaN. */
function clampAmount(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function ActionBar({ legal, onAct }: ActionBarProps) {
  const canSize = legal.canBet || legal.canRaise;
  // A short stack can leave min > max (no legal sized bet); only all-in remains.
  const canSizeInRange = canSize && legal.max >= legal.min;

  // Reset the draft and the submit guard whenever a new turn (new legal) arrives,
  // without the cascading-render cost of an effect.
  const [prevLegal, setPrevLegal] = useState(legal);
  const [draft, setDraft] = useState(String(legal.min));
  const [submitted, setSubmitted] = useState(false);
  if (legal !== prevLegal) {
    setPrevLegal(legal);
    setDraft(String(legal.min));
    setSubmitted(false);
  }

  const amount = clampAmount(Number(draft), legal.min, legal.max);

  // Guard against a fast double-click firing two actions before `legal` clears.
  const dispatch = (action: PlayerAction) => {
    if (submitted) return;
    setSubmitted(true);
    onAct(action);
  };

  return (
    <div className="action-bar">
      <p className="sr-only" role="status">
        Your turn to act
      </p>
      <div className="action-bar__buttons">
        {legal.canFold && (
          <button className="btn btn--fold" disabled={submitted} onClick={() => dispatch({ type: "fold" })}>
            Fold
          </button>
        )}
        {legal.canCheck && (
          <button className="btn btn--check" disabled={submitted} onClick={() => dispatch({ type: "check" })}>
            Check
          </button>
        )}
        {legal.canCall && (
          <button className="btn btn--call" disabled={submitted} onClick={() => dispatch({ type: "call" })}>
            Call {legal.callAmount}
          </button>
        )}
      </div>

      {canSizeInRange && (
        <div className="action-bar__raise">
          <input
            className="action-bar__slider"
            type="range"
            min={legal.min}
            max={legal.max}
            step={1}
            value={amount}
            aria-label="Bet size"
            aria-valuetext={`${amount} chips`}
            disabled={submitted}
            onChange={(e) => setDraft(e.target.value)}
          />
          <input
            className="action-bar__amount"
            type="number"
            min={legal.min}
            max={legal.max}
            step={1}
            value={draft}
            aria-label="Bet size in chips"
            disabled={submitted}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => setDraft(String(amount))}
          />
          <button
            className="btn btn--raise"
            disabled={submitted}
            onClick={() =>
              dispatch(legal.canRaise ? { type: "raise", amount } : { type: "bet", amount })
            }
          >
            {legal.canRaise ? "Raise to" : "Bet"} {amount}
          </button>
          <button className="btn btn--allin" disabled={submitted} onClick={() => dispatch({ type: "all-in" })}>
            All-in
          </button>
        </div>
      )}

      {canSize && !canSizeInRange && (
        <div className="action-bar__raise">
          <button className="btn btn--allin" disabled={submitted} onClick={() => dispatch({ type: "all-in" })}>
            All-in
          </button>
        </div>
      )}
    </div>
  );
}
