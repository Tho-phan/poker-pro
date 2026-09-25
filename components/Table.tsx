import type { WireHandResult, WireTableState } from "@/lib/protocol";
import { PlayerSeat } from "./PlayerSeat";
import { PlayingCard } from "./PlayingCard";

interface TableProps {
  table: WireTableState;
  playerId: string;
  lastResult: WireHandResult | null;
}

export function Table({ table, playerId, lastResult }: TableProps) {
  const you = table.players.find((p) => p.id === playerId);
  const opponent = table.players.find((p) => p.id !== playerId);
  const reveal = new Map(lastResult?.reveal.map((r) => [r.playerId, r]) ?? []);

  if (!you || !opponent) return null;

  return (
    <div className="table">
      <PlayerSeat
        player={opponent}
        label={opponent.isBot ? "Bot" : "Opponent"}
        isActing={table.actingPlayerId === opponent.id}
        isButton={table.buttonIndex === opponent.seat}
        revealedHole={reveal.get(opponent.id)?.hole ?? null}
        revealedDescription={reveal.get(opponent.id)?.description ?? null}
      />

      <div className="table__felt">
        <div className="table__pot">Pot: {table.pot}</div>
        <div className="table__board">
          {table.board.map((c) => (
            <PlayingCard key={c} card={c} />
          ))}
        </div>
        {lastResult && <ResultBanner result={lastResult} playerId={playerId} />}
      </div>

      <PlayerSeat
        player={you}
        label="You"
        isActing={table.actingPlayerId === you.id}
        isButton={table.buttonIndex === you.seat}
        revealedHole={null}
        revealedDescription={reveal.get(you.id)?.description ?? null}
      />
    </div>
  );
}

function ResultBanner({ result, playerId }: { result: WireHandResult; playerId: string }) {
  const yourNet = result.net.find((n) => n.playerId === playerId)?.amount ?? 0;
  const verb = yourNet > 0 ? "won" : yourNet < 0 ? "lost" : "pushed";

  return (
    <div className="result-banner">
      <div className={`result-banner__headline result-banner__headline--${verb}`}>
        You {verb} {yourNet !== 0 ? Math.abs(yourNet) : ""}
        {result.wonWithoutShowdown ? " (opponent folded)" : ""}
      </div>
    </div>
  );
}
