import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  LegalActions,
  ServerMessage,
  WireHandResult,
  WireTableState,
} from "./protocol";
import { useGame } from "./useGame";

/** A minimal WebSocket stand-in that records sent frames and lets tests drive events. */
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  url: string;
  sent: string[] = [];
  closed = false;
  private listeners: Record<string, Array<(ev: unknown) => void>> = {};

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, cb: (ev: unknown) => void) {
    (this.listeners[type] ??= []).push(cb);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, ev: unknown = {}) {
    for (const cb of this.listeners[type] ?? []) cb(ev);
  }

  emitServer(msg: ServerMessage) {
    this.emit("message", { data: JSON.stringify(msg) });
  }

  static last(): FakeWebSocket {
    const ws = FakeWebSocket.instances.at(-1);
    if (!ws) throw new Error("no FakeWebSocket created");
    return ws;
  }
}

const TABLE: WireTableState = {
  players: [
    {
      id: "human-1",
      seat: 0,
      stack: 995,
      committedThisStreet: 5,
      committedTotal: 5,
      status: "active",
      hole: ["Ks", "4d"],
      isBot: false,
    },
    {
      id: "bot",
      seat: 1,
      stack: 990,
      committedThisStreet: 10,
      committedTotal: 10,
      status: "active",
      hole: null,
      isBot: true,
    },
  ],
  board: [],
  street: "preflop",
  pot: 15,
  currentBet: 10,
  actingPlayerId: "human-1",
  buttonIndex: 0,
  handInProgress: true,
};

const LEGAL: LegalActions = {
  canFold: true,
  canCheck: false,
  canCall: true,
  callAmount: 5,
  canBet: false,
  canRaise: true,
  min: 20,
  max: 995,
};

const RESULT: WireHandResult = {
  board: ["9c", "Ad", "Qh", "9h", "7d"],
  wonWithoutShowdown: false,
  awards: [{ playerId: "human-1", amount: 120 }],
  net: [
    { playerId: "human-1", amount: 60 },
    { playerId: "bot", amount: -60 },
  ],
  reveal: [
    { playerId: "human-1", hole: ["Ks", "4d"], description: "Pair of nines" },
    { playerId: "bot", hole: ["3d", "Qs"], description: "Two pair" },
  ],
};

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useGame", () => {
  it("starts idle and connects on join, sending a join frame on open", () => {
    const { result } = renderHook(() => useGame("ws://test"));
    expect(result.current.state.status).toBe("idle");

    act(() => result.current.join("Alice"));
    expect(result.current.state.status).toBe("connecting");
    const ws = FakeWebSocket.last();
    expect(ws.url).toBe("ws://test");
    expect(ws.sent).toHaveLength(0); // nothing sent before the socket opens

    act(() => ws.emit("open"));
    expect(JSON.parse(ws.sent[0]!)).toEqual({ type: "join", name: "Alice" });
  });

  it("threads every server message into client-visible state", () => {
    const { result } = renderHook(() => useGame("ws://test"));
    act(() => result.current.join("Alice"));
    const ws = FakeWebSocket.last();

    act(() => ws.emitServer({ type: "joined", playerId: "human-1", seat: 0 }));
    expect(result.current.state.status).toBe("joined");
    expect(result.current.state.playerId).toBe("human-1");
    expect(result.current.state.seat).toBe(0);

    act(() => ws.emitServer({ type: "state", state: TABLE }));
    expect(result.current.state.table).toEqual(TABLE);

    act(() => ws.emitServer({ type: "your-turn", legal: LEGAL }));
    expect(result.current.state.legal).toEqual(LEGAL);

    act(() => ws.emitServer({ type: "acted", playerId: "bot", action: { type: "call" } }));
    expect(result.current.state.lastAction).toEqual({ playerId: "bot", action: { type: "call" } });
  });

  it("stores the hand result and clears the pending turn", () => {
    const { result } = renderHook(() => useGame("ws://test"));
    act(() => result.current.join("Alice"));
    const ws = FakeWebSocket.last();

    act(() => ws.emitServer({ type: "your-turn", legal: LEGAL }));
    act(() => ws.emitServer({ type: "hand-result", result: RESULT }));
    expect(result.current.state.lastResult).toEqual(RESULT);
    expect(result.current.state.legal).toBeNull();
  });

  it("keeps the result banner during the same hand but clears it when the next hand deals", () => {
    const { result } = renderHook(() => useGame("ws://test"));
    act(() => result.current.join("Alice"));
    const ws = FakeWebSocket.last();

    act(() => ws.emitServer({ type: "state", state: TABLE })); // button 0
    act(() => ws.emitServer({ type: "hand-result", result: RESULT }));
    // Post-result snapshot of the same hand (button unchanged) keeps the banner.
    act(() => ws.emitServer({ type: "state", state: { ...TABLE, handInProgress: false } }));
    expect(result.current.state.lastResult).toEqual(RESULT);

    // Next hand: the button moves, so the stale banner is cleared.
    act(() => ws.emitServer({ type: "state", state: { ...TABLE, buttonIndex: 1 } }));
    expect(result.current.state.lastResult).toBeNull();
  });

  it("sends an action frame and optimistically clears legal on act", () => {
    const { result } = renderHook(() => useGame("ws://test"));
    act(() => result.current.join("Alice"));
    const ws = FakeWebSocket.last();
    act(() => ws.emitServer({ type: "your-turn", legal: LEGAL }));

    act(() => result.current.act({ type: "raise", amount: 40 }));
    expect(result.current.state.legal).toBeNull();
    expect(JSON.parse(ws.sent.at(-1)!)).toEqual({
      type: "action",
      action: { type: "raise", amount: 40 },
    });
  });

  it("surfaces server errors and lets them be dismissed", () => {
    const { result } = renderHook(() => useGame("ws://test"));
    act(() => result.current.join("Alice"));
    const ws = FakeWebSocket.last();

    act(() => ws.emitServer({ type: "error", message: "not your turn" }));
    expect(result.current.state.error).toBe("not your turn");

    act(() => result.current.dismissError());
    expect(result.current.state.error).toBeNull();
  });

  it("marks the connection closed and errored on transport events", () => {
    const { result } = renderHook(() => useGame("ws://test"));
    act(() => result.current.join("Alice"));
    const ws = FakeWebSocket.last();

    act(() => ws.emit("error"));
    expect(result.current.state.status).toBe("error");
    expect(result.current.state.error).toMatch(/failed/i);

    act(() => ws.emit("close"));
    expect(result.current.state.status).toBe("closed");
  });
});
