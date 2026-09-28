import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LegalActions, PlayerAction } from "@/lib/protocol";
import { ActionBar } from "./ActionBar";

const CALL_OR_RAISE: LegalActions = {
  canFold: true,
  canCheck: false,
  canCall: true,
  callAmount: 5,
  canBet: false,
  canRaise: true,
  min: 20,
  max: 995,
};

const CHECK_OR_BET: LegalActions = {
  canFold: true,
  canCheck: true,
  canCall: false,
  callAmount: 0,
  canBet: true,
  canRaise: false,
  min: 10,
  max: 990,
};

describe("ActionBar", () => {
  it("only renders the actions the server marks legal", () => {
    render(<ActionBar legal={CHECK_OR_BET} onAct={vi.fn()} />);
    expect(screen.getByRole("button", { name: /fold/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /check/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^call/i })).not.toBeInTheDocument();
  });

  it("emits fold and call with no amount", async () => {
    const onAct = vi.fn<(a: PlayerAction) => void>();
    const user = userEvent.setup();
    render(<ActionBar legal={CALL_OR_RAISE} onAct={onAct} />);

    await user.click(screen.getByRole("button", { name: /call 5/i }));
    await user.click(screen.getByRole("button", { name: /fold/i }));

    expect(onAct).toHaveBeenNthCalledWith(1, { type: "call" });
    expect(onAct).toHaveBeenNthCalledWith(2, { type: "fold" });
  });

  it("defaults the sizing input to the min raise and raises to that amount", async () => {
    const onAct = vi.fn<(a: PlayerAction) => void>();
    const user = userEvent.setup();
    render(<ActionBar legal={CALL_OR_RAISE} onAct={onAct} />);

    await user.click(screen.getByRole("button", { name: /raise to 20/i }));
    expect(onAct).toHaveBeenCalledWith({ type: "raise", amount: 20 });
  });

  it("uses bet (not raise) when only betting is legal", async () => {
    const onAct = vi.fn<(a: PlayerAction) => void>();
    const user = userEvent.setup();
    render(<ActionBar legal={CHECK_OR_BET} onAct={onAct} />);

    await user.click(screen.getByRole("button", { name: /^bet 10/i }));
    expect(onAct).toHaveBeenCalledWith({ type: "bet", amount: 10 });
  });

  it("shoves the whole stack with all-in", async () => {
    const onAct = vi.fn<(a: PlayerAction) => void>();
    const user = userEvent.setup();
    render(<ActionBar legal={CALL_OR_RAISE} onAct={onAct} />);

    await user.click(screen.getByRole("button", { name: /all-in/i }));
    expect(onAct).toHaveBeenCalledWith({ type: "all-in" });
  });

  it("clamps a typed amount to the legal max", async () => {
    const onAct = vi.fn<(a: PlayerAction) => void>();
    const user = userEvent.setup();
    render(<ActionBar legal={CALL_OR_RAISE} onAct={onAct} />);

    const amount = screen.getByRole("spinbutton");
    fireEvent.change(amount, { target: { value: "999999" } });
    await user.click(screen.getByRole("button", { name: /raise to/i }));

    expect(onAct).toHaveBeenCalledWith({ type: "raise", amount: 995 });
  });

  it("resets the sizing input when a new turn (new legal) arrives", () => {
    const { rerender } = render(<ActionBar legal={CALL_OR_RAISE} onAct={vi.fn()} />);
    expect(screen.getByRole("spinbutton")).toHaveValue(20);

    rerender(<ActionBar legal={{ ...CHECK_OR_BET }} onAct={vi.fn()} />);
    expect(screen.getByRole("spinbutton")).toHaveValue(10);
  });
});
