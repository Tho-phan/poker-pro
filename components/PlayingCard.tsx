import { rankOf, suitOf, type Card, type Rank, type Suit } from "@/lib/protocol";

const SUIT_SYMBOL: Record<Suit, string> = {
  s: "♠",
  h: "♥",
  d: "♦",
  c: "♣",
};

const SUIT_NAME: Record<Suit, string> = {
  s: "spades",
  h: "hearts",
  d: "diamonds",
  c: "clubs",
};

const RANK_NAME: Record<Rank, string> = {
  "2": "Two",
  "3": "Three",
  "4": "Four",
  "5": "Five",
  "6": "Six",
  "7": "Seven",
  "8": "Eight",
  "9": "Nine",
  T: "Ten",
  J: "Jack",
  Q: "Queen",
  K: "King",
  A: "Ace",
};

const RED_SUITS: ReadonlySet<Suit> = new Set<Suit>(["h", "d"]);

export function PlayingCard({ card }: { card: Card }) {
  const rank = rankOf(card);
  const suit = suitOf(card);
  return (
    <div
      className={`card ${RED_SUITS.has(suit) ? "card--red" : "card--black"}`}
      role="img"
      aria-label={`${RANK_NAME[rank]} of ${SUIT_NAME[suit]}`}
    >
      <span className="card__rank" aria-hidden="true">
        {rank}
      </span>
      <span className="card__suit" aria-hidden="true">
        {SUIT_SYMBOL[suit]}
      </span>
    </div>
  );
}

export function CardBack() {
  return <div className="card card--back" role="img" aria-label="Hidden card" />;
}
