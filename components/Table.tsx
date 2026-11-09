import type { WireHandResult, WirePlayer, WireTableState } from "@/lib/protocol";
import { PlayerSeat } from "./PlayerSeat";
import { PlayingCard } from "./PlayingCard";

interface TableProps {
  table: WireTableState;
  playerId: string;
  lastResult: WireHandResult | null;
}

// Anchor points for up to 8 opponents around the oval rim (you sit bottom-center).
// Ordered left side → across the top → right side.
const SEAT_POS: ReadonlyArray<{ left: string; top: string }> = [
  { left: "12%", top: "68%" },
  { left: "6%", top: "33%" },
  { left: "22%", top: "8%" },
  { left: "40%", top: "2%" },
  { left: "60%", top: "2%" },
  { left: "78%", top: "8%" },
  { left: "94%", top: "33%" },
  { left: "88%", top: "68%" },
];

function seatLabel(p: WirePlayer): string {
  return p.isBot ? `Bot ${p.seat}` : `Seat ${p.seat}`;
}

export function Table({ table, playerId, lastResult }: TableProps) {
  const you = table.players.find((p) => p.id === playerId);
  // The server rotates participants so the button sits at index 0; identify the
  // button player by that array index, then render seats in stable seat order.
  const buttonId = table.players[table.buttonIndex]?.id ?? null;
  // Only trust a reveal once the hand is over — never surface a live hand's cards.
  const showReveal = !table.handInProgress && lastResult !== null;
  const reveal = new Map(showReveal ? lastResult.reveal.map((r) => [r.playerId, r]) : []);

  if (!you) return null;

  const opponents = table.players
    .filter((p) => p.id !== playerId)
    .sort((a, b) => a.seat - b.seat);

  return (
    <div className="table">
      <div className="felt">
        <div className="felt__center">
          <div className="table__pot">Pot: {table.pot}</div>
          <div className="table__board">
            {table.board.map((c) => (
              <PlayingCard key={c} card={c} />
            ))}
          </div>
          {showReveal && <ResultBanner result={lastResult} playerId={playerId} />}
        </div>

        {opponents.map((p, i) => {
          const pos = SEAT_POS[i] ?? SEAT_POS[SEAT_POS.length - 1]!;
          return (
            <div className="felt__seat" key={p.id} style={{ left: pos.left, top: pos.top }}>
              <PlayerSeat
                compact
                player={p}
                label={seatLabel(p)}
                isActing={table.actingPlayerId === p.id}
                isButton={p.id === buttonId}
                revealedHole={reveal.get(p.id)?.hole ?? null}
                revealedDescription={reveal.get(p.id)?.description ?? null}
              />
              {p.committedThisStreet > 0 && <div className="felt__chip">{p.committedThisStreet}</div>}
            </div>
          );
        })}

        <div className="felt__seat felt__seat--hero">
          {you.committedThisStreet > 0 && (
            <div className="felt__chip felt__chip--hero">{you.committedThisStreet}</div>
          )}
          <PlayerSeat
            player={you}
            label="You"
            isActing={table.actingPlayerId === you.id}
            isButton={you.id === buttonId}
            revealedHole={null}
            revealedDescription={reveal.get(you.id)?.description ?? null}
          />
        </div>
      </div>
    </div>
  );
}

function ResultBanner({ result, playerId }: { result: WireHandResult; playerId: string }) {
  const yourNet = result.net.find((n) => n.playerId === playerId)?.amount ?? 0;
  const verb = yourNet > 0 ? "won" : yourNet < 0 ? "lost" : "pushed";

  return (
    <div className="result-banner" role="status">
      <div className={`result-banner__headline result-banner__headline--${verb}`}>
        You {verb} {yourNet !== 0 ? Math.abs(yourNet) : ""}
        {result.wonWithoutShowdown ? " (uncontested)" : ""}
      </div>
    </div>
  );
}
