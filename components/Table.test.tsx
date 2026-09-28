import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { WireHandResult, WireTableState } from "@/lib/protocol";
import { Table } from "./Table";

const BASE: WireTableState = {
  players: [
    {
      id: "human-1",
      seat: 0,
      stack: 990,
      committedThisStreet: 0,
      committedTotal: 10,
      status: "active",
      hole: ["Ks", "4d"],
      isBot: false,
    },
    {
      id: "bot",
      seat: 1,
      stack: 990,
      committedThisStreet: 0,
      committedTotal: 10,
      status: "active",
      hole: null, // server never sends the opponent's cards mid-hand
      isBot: true,
    },
  ],
  board: ["9c", "Ad", "Qh"],
  street: "flop",
  pot: 20,
  currentBet: 0,
  actingPlayerId: "human-1",
  buttonIndex: 0,
  handInProgress: true,
};

const SHOWDOWN: WireHandResult = {
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

function seatOf(container: HTMLElement, label: string): HTMLElement {
  const heading = screen.getByText(label);
  const seat = heading.closest(".seat");
  if (!seat) throw new Error(`no seat for ${label}`);
  return seat as HTMLElement;
}

describe("Table", () => {
  it("shows your hole cards but hides the opponent's behind card backs mid-hand", () => {
    const { container } = render(
      <Table table={BASE} playerId="human-1" lastResult={null} />,
    );

    const you = seatOf(container, "You");
    expect(within(you).getByText("K")).toBeInTheDocument();
    expect(within(you).getByText("4")).toBeInTheDocument();
    expect(you.querySelectorAll(".card--back")).toHaveLength(0);

    const bot = seatOf(container, "Bot");
    expect(bot.querySelectorAll(".card--back")).toHaveLength(2);
    // No opponent rank should be leaked into the DOM.
    expect(bot.querySelector(".card__rank")).toBeNull();
  });

  it("renders the shared board and pot", () => {
    const { container } = render(
      <Table table={BASE} playerId="human-1" lastResult={null} />,
    );
    expect(screen.getByText(/pot: 20/i)).toBeInTheDocument();
    const board = container.querySelector(".table__board")!;
    expect(board.querySelectorAll(".card")).toHaveLength(3);
  });

  it("reveals the opponent's cards and hand description at showdown", () => {
    const { container } = render(
      <Table table={BASE} playerId="human-1" lastResult={SHOWDOWN} />,
    );

    const bot = seatOf(container, "Bot");
    expect(bot.querySelectorAll(".card--back")).toHaveLength(0);
    expect(within(bot).getByText("3")).toBeInTheDocument();
    expect(within(bot).getByText("Two pair")).toBeInTheDocument();
  });

  it("announces a win from the viewer's net amount", () => {
    render(<Table table={BASE} playerId="human-1" lastResult={SHOWDOWN} />);
    expect(screen.getByText(/you won 60/i)).toBeInTheDocument();
  });

  it("announces a loss from the viewer's net amount", () => {
    const lost: WireHandResult = {
      ...SHOWDOWN,
      net: [
        { playerId: "human-1", amount: -60 },
        { playerId: "bot", amount: 60 },
      ],
    };
    render(<Table table={BASE} playerId="human-1" lastResult={lost} />);
    expect(screen.getByText(/you lost 60/i)).toBeInTheDocument();
  });

  it("notes when a hand was won without showdown", () => {
    const folded: WireHandResult = {
      board: ["9c", "Ad", "Qh"],
      wonWithoutShowdown: true,
      awards: [{ playerId: "human-1", amount: 20 }],
      net: [
        { playerId: "human-1", amount: 10 },
        { playerId: "bot", amount: -10 },
      ],
      reveal: [],
    };
    render(<Table table={BASE} playerId="human-1" lastResult={folded} />);
    expect(screen.getByText(/opponent folded/i)).toBeInTheDocument();
  });
});
