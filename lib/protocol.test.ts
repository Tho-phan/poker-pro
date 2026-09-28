import { describe, expect, it } from "vitest";
import { rankOf, suitOf, type Card } from "./protocol";

describe("protocol card helpers", () => {
  it("splits rank and suit for every card shape", () => {
    const cases: Array<[Card, string, string]> = [
      ["As", "A", "s"],
      ["Td", "T", "d"],
      ["2c", "2", "c"],
      ["9h", "9", "h"],
      ["Kh", "K", "h"],
    ];
    for (const [card, rank, suit] of cases) {
      expect(rankOf(card)).toBe(rank);
      expect(suitOf(card)).toBe(suit);
    }
  });
});
