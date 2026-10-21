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
  lastResult: WireHandResult | null;
  error: string | null;
}

const INITIAL_STATE: GameState = {
  status: "idle",
  playerId: null,
  seat: null,
  table: null,
  legal: null,
  lastResult: null,
  error: null,
};

/** Give up on a join that connects but never gets a `joined` reply. */
const JOIN_TIMEOUT_MS = 10_000;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isWireTable(value: unknown): value is WireTableState {
  return (
    isObject(value) &&
    Array.isArray(value.players) &&
    Array.isArray(value.board) &&
    typeof value.pot === "number" &&
    typeof value.buttonIndex === "number" &&
    typeof value.handInProgress === "boolean" &&
    (value.actingPlayerId === null || typeof value.actingPlayerId === "string")
  );
}

/**
 * Validate an untrusted server frame before it reaches React state. The socket
 * is a trust boundary: a malformed frame must never throw during render (there
 * is no error boundary) or let a bad shape crash a consumer like <Table>. On
 * any failure we return null and the caller surfaces an error instead.
 */
export function parseServerMessage(raw: unknown): ServerMessage | null {
  if (typeof raw !== "string") return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(data) || typeof data.type !== "string") return null;

  switch (data.type) {
    case "joined":
      return typeof data.playerId === "string" && typeof data.seat === "number"
        ? { type: "joined", playerId: data.playerId, seat: data.seat }
        : null;
    case "state":
      return isWireTable(data.state) ? { type: "state", state: data.state } : null;
    case "your-turn":
      return isObject(data.legal)
        ? { type: "your-turn", legal: data.legal as unknown as LegalActions }
        : null;
    case "acted":
      return typeof data.playerId === "string" && isObject(data.action)
        ? { type: "acted", playerId: data.playerId, action: data.action as unknown as PlayerAction }
        : null;
    case "hand-result":
      return isObject(data.result)
        ? { type: "hand-result", result: data.result as unknown as WireHandResult }
        : null;
    case "error":
      return typeof data.message === "string" ? { type: "error", message: data.message } : null;
    default:
      return null;
  }
}

function reduce(prev: GameState, msg: ServerMessage): GameState {
  switch (msg.type) {
    case "joined":
      return { ...prev, status: "joined", playerId: msg.playerId, seat: msg.seat };
    case "state": {
      // The first snapshot of a freshly dealt hand (handInProgress true again)
      // supersedes the prior hand's result banner. Using handInProgress rather
      // than a button-rotation guess survives reconnects and non-rotating buttons.
      const clearResult = msg.state.handInProgress && prev.lastResult !== null;
      return { ...prev, table: msg.state, lastResult: clearResult ? null : prev.lastResult };
    }
    case "your-turn":
      return { ...prev, legal: msg.legal };
    case "acted":
      return prev; // the authoritative follow-up `state` carries the effect
    case "hand-result":
      return { ...prev, lastResult: msg.result, legal: null };
    case "error":
      return { ...prev, error: msg.message };
    default:
      msg satisfies never; // compile-time guarantee every message type is handled
      return prev;
  }
}

/** Owns the WebSocket connection to the game server and the client-visible game state. */
export function useGame(wsUrl: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const joinedRef = useRef(false);
  const joinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<GameState>(INITIAL_STATE);

  const clearJoinTimer = useCallback(() => {
    if (joinTimerRef.current !== null) {
      clearTimeout(joinTimerRef.current);
      joinTimerRef.current = null;
    }
  }, []);

  /** Send a frame only when the socket is open; report whether it went out. */
  const send = useCallback((msg: ClientMessage): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(msg));
    return true;
  }, []);

  const join = useCallback(
    (name: string) => {
      wsRef.current?.close();
      clearJoinTimer();
      joinedRef.current = false;
      setState({ ...INITIAL_STATE, status: "connecting" });

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.addEventListener("open", () => {
        if (wsRef.current !== ws) return;
        ws.send(JSON.stringify({ type: "join", name } satisfies ClientMessage));
        joinTimerRef.current = setTimeout(() => {
          if (wsRef.current !== ws || joinedRef.current) return;
          wsRef.current = null;
          ws.close();
          setState((prev) => ({
            ...prev,
            status: "error",
            error: "The game server did not respond to the join request.",
          }));
        }, JOIN_TIMEOUT_MS);
      });

      ws.addEventListener("message", (event) => {
        if (wsRef.current !== ws) return; // ignore frames from a superseded socket
        const msg = parseServerMessage(event.data);
        if (!msg) {
          setState((prev) => ({ ...prev, error: "Received a malformed message from the server." }));
          return;
        }
        if (msg.type === "joined") {
          joinedRef.current = true;
          clearJoinTimer();
        }
        // A rejection before we ever sat down means the connection is dead.
        if (msg.type === "error" && !joinedRef.current) {
          clearJoinTimer();
          wsRef.current = null;
          ws.close();
          setState((prev) => ({ ...prev, status: "error", legal: null, error: msg.message }));
          return;
        }
        setState((prev) => reduce(prev, msg));
      });

      ws.addEventListener("close", () => {
        if (wsRef.current !== ws) return;
        clearJoinTimer();
        setState((prev) => ({ ...prev, status: "closed", legal: null }));
      });

      ws.addEventListener("error", () => {
        if (wsRef.current !== ws) return;
        clearJoinTimer();
        setState((prev) => ({
          ...prev,
          status: "error",
          legal: null,
          error: "Connection to game server failed.",
        }));
      });
    },
    [wsUrl, clearJoinTimer],
  );

  const act = useCallback(
    (action: PlayerAction) => {
      if (send({ type: "action", action })) {
        setState((prev) => ({ ...prev, legal: null }));
      } else {
        setState((prev) => ({ ...prev, error: "Not connected — your action was not sent." }));
      }
    },
    [send],
  );

  const dismissError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  useEffect(() => {
    return () => {
      clearJoinTimer();
      const ws = wsRef.current;
      wsRef.current = null; // detach handlers' identity guard before closing
      ws?.close();
    };
  }, [clearJoinTimer]);

  return { state, join, act, dismissError };
}
