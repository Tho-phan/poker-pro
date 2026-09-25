"use client";

import { useState } from "react";
import type { LegalActions, PlayerAction } from "@/lib/protocol";

interface ActionBarProps {
  legal: LegalActions;
  onAct: (action: PlayerAction) => void;
}

export function ActionBar({ legal, onAct }: ActionBarProps) {
  const canSize = legal.canBet || legal.canRaise;

  // Reset the sizing input whenever a new `legal` arrives (a fresh turn),
  // without the cascading-render cost of doing it in an effect.
  const [prevLegal, setPrevLegal] = useState(legal);
  const [amount, setAmount] = useState(legal.min);
  if (legal !== prevLegal) {
    setPrevLegal(legal);
    setAmount(legal.min);
  }

  return (
    <div className="action-bar">
      <div className="action-bar__buttons">
        {legal.canFold && (
          <button className="btn btn--fold" onClick={() => onAct({ type: "fold" })}>
            Fold
          </button>
        )}
        {legal.canCheck && (
          <button className="btn btn--check" onClick={() => onAct({ type: "check" })}>
            Check
          </button>
        )}
        {legal.canCall && (
          <button className="btn btn--call" onClick={() => onAct({ type: "call" })}>
            Call {legal.callAmount}
          </button>
        )}
      </div>
      {canSize && (
        <div className="action-bar__raise">
          <input
            className="action-bar__slider"
            type="range"
            min={legal.min}
            max={legal.max}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
          <input
            className="action-bar__amount"
            type="number"
            min={legal.min}
            max={legal.max}
            value={amount}
            onChange={(e) => setAmount(clamp(Number(e.target.value), legal.min, legal.max))}
          />
          <button
            className="btn btn--raise"
            onClick={() =>
              onAct(legal.canRaise ? { type: "raise", amount } : { type: "bet", amount })
            }
          >
            {legal.canRaise ? "Raise to" : "Bet"} {amount}
          </button>
          <button className="btn btn--allin" onClick={() => onAct({ type: "all-in" })}>
            All-in
          </button>
        </div>
      )}
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}
