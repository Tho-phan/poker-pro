"use client";

import { useState } from "react";
import { ActionBar } from "@/components/ActionBar";
import { Table } from "@/components/Table";
import { useGame } from "@/lib/useGame";

// Must be wss:// behind an HTTPS deployment or the browser blocks it as mixed content.
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080";

export default function Home() {
  const { state, join, act, dismissError } = useGame(WS_URL);
  const [name, setName] = useState("Player");

  const isYourTurn = state.table?.actingPlayerId != null && state.table.actingPlayerId === state.playerId;
  const inGame = Boolean(state.table && state.playerId);

  return (
    <main className={`page ${inGame ? "" : "page--entry"}`}>
      <h1 className="page__title">Poker Pro</h1>

      {state.error && (
        <div className="banner banner--error" role="alert">
          <span>{state.error}</span>
          <button type="button" className="banner__dismiss" onClick={dismissError} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}

      {state.status !== "joined" && state.status !== "closed" ? (
        <form
          className="join-form"
          onSubmit={(e) => {
            e.preventDefault();
            join(name.trim() || "Player");
          }}
        >
          <label className="join-form__label" htmlFor="player-name">
            Your name
          </label>
          <input
            id="player-name"
            className="join-form__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="Your name"
          />
          <button className="btn btn--primary" type="submit" disabled={state.status === "connecting"}>
            {state.status === "connecting" ? "Connecting..." : "Sit down"}
          </button>
        </form>
      ) : null}

      {!inGame && state.status !== "closed" && (
        <p className="entry-hint">Enter a name and take the seat to play a hand against the house bot.</p>
      )}

      {state.status === "closed" ? (
        <div className="banner" role="status">
          Disconnected from the game server.{" "}
          <button className="btn btn--primary" onClick={() => join(name.trim() || "Player")}>
            Reconnect
          </button>
        </div>
      ) : null}

      {state.table && state.playerId && (
        <Table table={state.table} playerId={state.playerId} lastResult={state.lastResult} />
      )}

      {state.legal && isYourTurn && (
        <ActionBar legal={state.legal} pot={state.table?.pot ?? 0} onAct={act} />
      )}
    </main>
  );
}
