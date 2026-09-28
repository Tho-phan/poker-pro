import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CardBack, PlayingCard } from "./PlayingCard";

describe("PlayingCard", () => {
  it("renders rank and a suit glyph", () => {
    const { container } = render(<PlayingCard card="Ks" />);
    expect(screen.getByText("K")).toBeInTheDocument();
    expect(container.querySelector(".card__suit")?.textContent).toBe("♠");
  });

  it("colors red suits red and black suits black", () => {
    const { container: red } = render(<PlayingCard card="Ah" />);
    expect(red.querySelector(".card")).toHaveClass("card--red");

    const { container: black } = render(<PlayingCard card="Ac" />);
    expect(black.querySelector(".card")).toHaveClass("card--black");
  });

  it("renders a face-down back with no rank", () => {
    const { container } = render(<CardBack />);
    expect(container.querySelector(".card--back")).toBeInTheDocument();
    expect(container.textContent).toBe("");
  });
});
