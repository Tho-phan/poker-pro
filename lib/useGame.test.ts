import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LegalActions, ServerMessage, WireHandResult, WireTableState } from "./protocol";
import { parseServerMessage, useGame } from "./useGame";

/** A WebSocket stand-in: records sent frames, models readyState, and drives events. */
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  url: string;
  sent: string[] = [];
  readyState = FakeWebSocket.CONNECTING;
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
    this.readyState = FakeWebSocket.CLOSED;
  }

  emit(type: string, ev: unknown = {}) {
    for (const cb of this.listeners[type] ?? []) cb(ev);
  }

  /** Transition to OPEN and fire the open event, like a real handshake completing. */
  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.emit("open");
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
    { id: "human-1", seat: 0, stack: 995, committedThisStreet: 5, committedTotal: 5, status: "active", hole: ["Ks", "4d"], isBot: false },
    { id: "bot", seat: 1, stack: 990, committedThisStreet: 10, committedTotal: 10, status: "active", hole: null, isBot: true },
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
  reveal: [{ playerId: "human-1", hole: ["Ks", "4d"], description: "Pair of nines" }],
};

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseServerMessage", () => {
  it("rejects non-strings, malformed JSON, and missing/unknown type", () => {
    expect(parseServerMessage(42)).toBeNull();
    expect(parseServerMessage("{not json")).toBeNull();
    expect(parseServerMessage(JSON.stringify({ foo: 1 }))).toBeNull();
    expect(parseServerMessage(JSON.stringify({ type: "nope" }))).toBeNull();
  });

  it("rejects a well-typed frame with a structurally invalid body", () => {
    // `state` without a players array would crash <Table>; it must not pass.
    expect(parseServerMessage(JSON.stringify({ type: "state", state: { pot: 5 } }))).toBeNull();
    expect(parseServerMessage(JSON.stringify({ type: "joined", playerId: "x" }))).toBeNull();
  });

  it("accepts valid frames", () => {
    expect(parseServerMessage(JSON.stringify({ type: "joined", playerId: "human-1", seat: 0 }))).toEqual({
      type: "joined",
      playerId: "human-1",
      seat: 0,
    });
    expect(parseServerMessage(JSON.stringify({ type: "state", state: TABLE }))).toEqual({ type: "state", state: TABLE });
  });
});

describe("useGame", () => {
  it("starts idle and sends a join frame once the socket opens", () => {
    const { result } = renderHook(() => useGame("ws://test"));
    expect(result.current.state.status).toBe("idle");

    act(() => result.current.join("Alice"));
    expect(result.current.state.status).toBe("connecting");
    const ws = FakeWebSocket.last();
    expect(ws.sent).toHaveLength(0); // nothing sent before open

    act(() => ws.open());
    expect(JSON.parse(ws.sent[0]!)).toEqual({ type: "join", name: "Alice" });
  });

  it("threads server messages into client-visible state", () => {
    const { result } = renderHook(() => useGame("ws://test"));
    act(() => result.current.join("Alice"));
    const ws = FakeWebSocket.last();
    act(() => ws.open());

    act(() => ws.emitServer({ type: "joined", playerId: "human-1", seat: 0 }));
    expect(result.current.state.status).toBe("joined");
    expect(result.current.state.playerId).toBe("human-1");

    act(() => ws.emitServer({ type: "state", state: TABLE }));
    expect(result.current.state.table).toEqual(TABLE);

    act(() => ws.emitServer({ type: "your-turn", legal: LEGAL }));
    expect(result.current.state.legal).toEqual(LEGAL);
  });

  it("stores the hand result and clears the pending turn", () => {
    const { result } = renderHook(() => useGame("ws://test"));
    act(() => result.current.join("Alice"));
    const ws = FakeWebSocket.last();
    act(() => ws.open());

    act(() => ws.emitServer({ type: "your-turn", legal: LEGAL }));
    act(() => ws.emitServer({ type: "hand-result", result: RESULT }));
    expect(result.current.state.lastResult).toEqual(RESULT);
    expect(result.current.state.legal).toBeNull();
  });

  it("keeps the banner until the next hand is dealt (handInProgress true again)", () => {
    const { result } = renderHook(() => useGame("ws://test"));
    act(() => result.current.join("Alice"));
    const ws = FakeWebSocket.last();
    act(() => ws.open());

    act(() => ws.emitServer({ type: "state", state: TABLE }));
    act(() => ws.emitServer({ type: "hand-result", result: RESULT }));
    // Final snapshot of the finished hand keeps the banner.
    act(() => ws.emitServer({ type: "state", state: { ...TABLE, handInProgress: false } }));
    expect(result.current.state.lastResult).toEqual(RESULT);

    // Next hand deals (handInProgress true again): banner clears.
    act(() => ws.emitServer({ type: "state", state: { ...TABLE, handInProgress: true } }));
    expect(result.current.state.lastResult).toBeNull();
  });

  it("sends an action frame and clears legal when the socket is open", () => {
    const { result } = renderHook(() => useGame("ws://test"));
    act(() => result.current.join("Alice"));
    const ws = FakeWebSocket.last();
    act(() => ws.open());
    act(() => ws.emitServer({ type: "your-turn", legal: LEGAL }));

    act(() => result.current.act({ type: "raise", amount: 40 }));
    expect(result.current.state.legal).toBeNull();
    expect(JSON.parse(ws.sent.at(-1)!)).toEqual({ type: "action", action: { type: "raise", amount: 40 } });
  });

  it("does not drop a turn silently when the socket is not open", () => {
    const { result } = renderHook(() => useGame("ws://test"));
    act(() => result.current.join("Alice")); // still CONNECTING
    const ws = FakeWebSocket.last();
    act(() => ws.open());
    act(() => ws.emitServer({ type: "your-turn", legal: LEGAL }));
    act(() => ws.close()); // socket drops

    act(() => result.current.act({ type: "call" }));
    expect(result.current.state.error).toMatch(/not connected/i);
    // No action frame should have gone out after the socket closed.
    expect(ws.sent.some((f) => f.includes('"action"'))).toBe(false);
  });

  it("surfaces and dismisses an in-hand server error without dropping legal", () => {
    const { result } = renderHook(() => useGame("ws://test"));
    act(() => result.current.join("Alice"));
    const ws = FakeWebSocket.last();
    act(() => ws.open());
    act(() => ws.emitServer({ type: "joined", playerId: "human-1", seat: 0 }));
    act(() => ws.emitServer({ type: "your-turn", legal: LEGAL }));

    act(() => ws.emitServer({ type: "error", message: "not your turn" }));
    expect(result.current.state.error).toBe("not your turn");
    expect(result.current.state.legal).toEqual(LEGAL); // in-hand error keeps the turn

    act(() => result.current.dismissError());
    expect(result.current.state.error).toBeNull();
  });

  it("errors out of a join rejected before sitting down", () => {
    const { result } = renderHook(() => useGame("ws://test"));
    act(() => result.current.join("Alice"));
    const ws = FakeWebSocket.last();
    act(() => ws.open());

    act(() => ws.emitServer({ type: "error", message: "table full" }));
    expect(result.current.state.status).toBe("error");
    expect(result.current.state.error).toBe("table full");
    expect(ws.readyState).toBe(FakeWebSocket.CLOSED);
  });

  it("surfaces a malformed frame as an error instead of throwing", () => {
    const { result } = renderHook(() => useGame("ws://test"));
    act(() => result.current.join("Alice"));
    const ws = FakeWebSocket.last();
    act(() => ws.open());
    act(() => ws.emitServer({ type: "joined", playerId: "human-1", seat: 0 }));

    act(() => ws.emit("message", { data: "{garbage" }));
    expect(result.current.state.error).toMatch(/malformed/i);
    expect(result.current.state.status).toBe("joined"); // connection survives
  });

  it("ignores events from a superseded socket after reconnect", () => {
    const { result } = renderHook(() => useGame("ws://test"));
    act(() => result.current.join("Alice"));
    const first = FakeWebSocket.last();
    act(() => first.open());

    act(() => result.current.join("Alice")); // reconnect → new socket
    const second = FakeWebSocket.last();
    expect(second).not.toBe(first);

    // The old socket's late close must not mark the new session closed.
    act(() => first.emit("close"));
    expect(result.current.state.status).toBe("connecting");
  });

  it("clears legal and marks closed when the socket drops", () => {
    const { result } = renderHook(() => useGame("ws://test"));
    act(() => result.current.join("Alice"));
    const ws = FakeWebSocket.last();
    act(() => ws.open());
    act(() => ws.emitServer({ type: "your-turn", legal: LEGAL }));

    act(() => ws.emit("close"));
    expect(result.current.state.status).toBe("closed");
    expect(result.current.state.legal).toBeNull();
  });

  it("errors a join that connects but never gets a joined reply", () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useGame("ws://test"));
      act(() => result.current.join("Alice"));
      const ws = FakeWebSocket.last();
      act(() => ws.open());

      act(() => vi.advanceTimersByTime(10_000));
      expect(result.current.state.status).toBe("error");
      expect(ws.readyState).toBe(FakeWebSocket.CLOSED);
    } finally {
      vi.useRealTimers();
    }
  });
});
