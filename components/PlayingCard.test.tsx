import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CardBack, PlayingCard } from "./PlayingCard";

describe("PlayingCard", () => {
  it("renders rank and a suit glyph", () => {
    const { container } = render(<PlayingCard card="Ks" />);
    expect(screen.getByText("K")).toBeInTheDocument();
    expect(container.querySelector(".card__suit")?.textContent).toBe("♠");
  });

  it("exposes an accessible name for screen readers", () => {
    render(<PlayingCard card="Ah" />);
    expect(screen.getByRole("img", { name: "Ace of hearts" })).toBeInTheDocument();
  });

  it("colors red suits red and black suits black", () => {
    const { container: red } = render(<PlayingCard card="Ah" />);
    expect(red.querySelector(".card")).toHaveClass("card--red");

    const { container: black } = render(<PlayingCard card="Ac" />);
    expect(black.querySelector(".card")).toHaveClass("card--black");
  });

  it("renders a face-down back labeled as hidden, with no rank", () => {
    render(<CardBack />);
    const back = screen.getByRole("img", { name: "Hidden card" });
    expect(back).toHaveClass("card--back");
    expect(back.textContent).toBe("");
  });
});
