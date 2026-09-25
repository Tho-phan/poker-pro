/**
 * Wire contract with the poker-pro-BE game server, mirrored here because this
 * is a separate repo/deployment (no shared workspace). Keep in sync with
 * poker-pro-BE's packages/protocol — that repo is the source of truth.
 */

export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "T" | "J" | "Q" | "K" | "A";
export type Suit = "s" | "h" | "d" | "c";

/** A single playing card, e.g. "As" (ace of spades), "Th" (ten of hearts). */
export type Card = `${Rank}${Suit}`;

export function rankOf(card: Card): Rank {
  return card[0] as Rank;
}

export function suitOf(card: Card): Suit {
  return card[1] as Suit;
}

export type PlayerAction =
  | { type: "fold" }
  | { type: "check" }
  | { type: "call" }
  | { type: "bet"; amount: number }
  | { type: "raise"; amount: number }
  | { type: "all-in" };

export type Street = "preflop" | "flop" | "turn" | "river";

export type PlayerStatus = "active" | "folded" | "all-in";

export interface LegalActions {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canBet: boolean;
  canRaise: boolean;
  /** Min/max TOTAL committed-this-street a bet/raise may reach (the "to" amount). */
  min: number;
  max: number;
}

export interface WirePlayer {
  id: string;
  seat: number;
  stack: number;
  committedThisStreet: number;
  committedTotal: number;
  status: PlayerStatus;
  /** The player's hole cards, or null when hidden from the viewer. */
  hole: Card[] | null;
  isBot: boolean;
}

export interface WireTableState {
  players: WirePlayer[];
  board: Card[];
  street: Street;
  pot: number;
  currentBet: number;
  /** Id of the player to act, or null when no one is (dealing / hand over). */
  actingPlayerId: string | null;
  buttonIndex: number;
  handInProgress: boolean;
}

export interface WireHandResult {
  board: Card[];
  wonWithoutShowdown: boolean;
  awards: Array<{ playerId: string; amount: number }>;
  net: Array<{ playerId: string; amount: number }>;
  reveal: Array<{ playerId: string; hole: Card[]; description: string }>;
}

export type ClientMessage = { type: "join"; name: string } | { type: "action"; action: PlayerAction };

export type ServerMessage =
  | { type: "joined"; playerId: string; seat: number }
  | { type: "state"; state: WireTableState }
  | { type: "your-turn"; legal: LegalActions }
  | { type: "acted"; playerId: string; action: PlayerAction }
  | { type: "hand-result"; result: WireHandResult }
  | { type: "error"; message: string };
