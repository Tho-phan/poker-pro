"use client";

import { useState } from "react";
import { ActionBar } from "@/components/ActionBar";
import { Table } from "@/components/Table";
import { useGame } from "@/lib/useGame";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080";

export default function Home() {
  const { state, join, act, dismissError } = useGame(WS_URL);
  const [name, setName] = useState("Player");

  return (
    <main className="page">
      <h1 className="page__title">Poker Pro</h1>

      {state.error && (
        <div className="banner banner--error" onClick={dismissError}>
          {state.error}
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
          <input
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
      ) : state.status === "closed" ? (
        <div className="banner">
          Disconnected from the game server.{" "}
          <button className="btn btn--primary" onClick={() => join(name.trim() || "Player")}>
            Reconnect
          </button>
        </div>
      ) : null}

      {state.table && state.playerId && (
        <Table table={state.table} playerId={state.playerId} lastResult={state.lastResult} />
      )}

      {state.legal && <ActionBar legal={state.legal} onAct={act} />}
    </main>
  );
}
