import type { Card, WirePlayer } from "@/lib/protocol";
import { CardBack, PlayingCard } from "./PlayingCard";

interface PlayerSeatProps {
  player: WirePlayer;
  label: string;
  isActing: boolean;
  isButton: boolean;
  revealedHole: Card[] | null;
  revealedDescription: string | null;
}

export function PlayerSeat({
  player,
  label,
  isActing,
  isButton,
  revealedHole,
  revealedDescription,
}: PlayerSeatProps) {
  const hole = player.hole ?? revealedHole;

  return (
    <div className={`seat ${isActing ? "seat--acting" : ""} ${player.status === "folded" ? "seat--folded" : ""}`}>
      <div className="seat__cards">
        {hole
          ? hole.map((c) => <PlayingCard key={c} card={c} />)
          : player.status !== "folded" && [0, 1].map((i) => <CardBack key={i} />)}
      </div>
      <div className="seat__info">
        <div className="seat__name">
          {label}
          {isButton && <span className="seat__button">D</span>}
        </div>
        <div className="seat__stack">{player.stack} chips</div>
        {player.committedThisStreet > 0 && (
          <div className="seat__committed">bet {player.committedThisStreet}</div>
        )}
        <div className="seat__status">{describeStatus(player.status)}</div>
        {revealedDescription && <div className="seat__description">{revealedDescription}</div>}
      </div>
    </div>
  );
}

function describeStatus(status: WirePlayer["status"]): string {
  switch (status) {
    case "folded":
      return "Folded";
    case "all-in":
      return "All-in";
    default:
      return "";
  }
}
