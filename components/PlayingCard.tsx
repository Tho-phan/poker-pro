import { rankOf, suitOf, type Card } from "@/lib/protocol";

const SUIT_SYMBOL: Record<string, string> = {
  s: "♠",
  h: "♥",
  d: "♦",
  c: "♣",
};

const RED_SUITS = new Set(["h", "d"]);

export function PlayingCard({ card }: { card: Card }) {
  const suit = suitOf(card);
  return (
    <div className={`card ${RED_SUITS.has(suit) ? "card--red" : "card--black"}`}>
      <span className="card__rank">{rankOf(card)}</span>
      <span className="card__suit">{SUIT_SYMBOL[suit]}</span>
    </div>
  );
}

export function CardBack() {
  return <div className="card card--back" />;
}
