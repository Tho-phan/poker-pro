"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ClientMessage,
  LegalActions,
  PlayerAction,
  ServerMessage,
  WireHandResult,
  WireTableState,
} from "./protocol";

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "joined"
  | "closed"
  | "error";

export interface GameState {
  status: ConnectionStatus;
  playerId: string | null;
  seat: number | null;
  table: WireTableState | null;
  legal: LegalActions | null;
  lastAction: { playerId: string; action: PlayerAction } | null;
  lastResult: WireHandResult | null;
  error: string | null;
}

const INITIAL_STATE: GameState = {
  status: "idle",
  playerId: null,
  seat: null,
  table: null,
  legal: null,
  lastAction: null,
  lastResult: null,
  error: null,
};

/** Owns the WebSocket connection to the game server and the client-visible game state. */
export function useGame(wsUrl: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<GameState>(INITIAL_STATE);

  const send = useCallback((msg: ClientMessage) => {
    wsRef.current?.send(JSON.stringify(msg));
  }, []);

  const join = useCallback(
    (name: string) => {
      wsRef.current?.close();
      setState({ ...INITIAL_STATE, status: "connecting" });

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.addEventListener("open", () => {
        ws.send(JSON.stringify({ type: "join", name } satisfies ClientMessage));
      });

      ws.addEventListener("message", (event) => {
        const msg = JSON.parse(event.data as string) as ServerMessage;
        setState((prev) => {
          switch (msg.type) {
            case "joined":
              return { ...prev, status: "joined", playerId: msg.playerId, seat: msg.seat };
            case "state": {
              // A new hand's first snapshot (blinds posted) supersedes the
              // previous hand's result banner.
              const isNewHand = prev.table != null && prev.table.buttonIndex !== msg.state.buttonIndex;
              return { ...prev, table: msg.state, lastResult: isNewHand ? null : prev.lastResult };
            }
            case "your-turn":
              return { ...prev, legal: msg.legal };
            case "acted":
              return { ...prev, lastAction: { playerId: msg.playerId, action: msg.action } };
            case "hand-result":
              return { ...prev, lastResult: msg.result, legal: null };
            case "error":
              return { ...prev, error: msg.message };
            default:
              return prev;
          }
        });
      });

      ws.addEventListener("close", () => {
        setState((prev) => ({ ...prev, status: "closed" }));
      });

      ws.addEventListener("error", () => {
        setState((prev) => ({ ...prev, status: "error", error: "Connection to game server failed." }));
      });
    },
    [wsUrl],
  );

  const act = useCallback(
    (action: PlayerAction) => {
      setState((prev) => ({ ...prev, legal: null }));
      send({ type: "action", action });
    },
    [send],
  );

  const dismissError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  useEffect(() => {
    return () => wsRef.current?.close();
  }, []);

  return { state, join, act, dismissError };
}
