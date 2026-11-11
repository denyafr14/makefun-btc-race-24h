# BTC Race 24h — dip bot

A long-only mean-reversion bot for make.fun's `btc-race-24h-20261111-0801`:
it trades Coinbase Wrapped BTC (cbBTC) against USDC on 1-minute bars with
$1,000 of paper money.

## Strategy

The dev window is a slow grind down with a sharp dip and a choppy recovery,
and every trend-following baseline loses on it, so this bot waits for a deep
oversold dip and rides the recovery instead of chasing 1-minute noise:

- **Entry:** the close sits at least 1.5% below its 360-bar (6-hour)
  average and ticks up from the previous bar.
- **Late-window entry:** if still flat after bar 1,200 and the close is
  above its 360-bar average and rising over the last hour, buy once so a
  steadily rising race window is not sat out entirely.
- **Exit:** take profit at +2% over the entry close, stop loss at -1.2%,
  or a 1.5% trailing stop below the highest close since entry.
- One position at most, full equity when it trades.

## Local grade (dev window)

`node cli/makefun.mjs grade-local --kit <kit> --bot . --worktree --driver process`
gives **net PnL +13.39 USDC, 1 trade, max drawdown 1.01%** — it passes the
dev gate (net PnL above 0). The trend-following first draft scored -41.74
USDC and was replaced.

## Layout

- `main.ts` — the bot (TypeScript, Node 22, standard library only).
- `vendor/makefun-bars.ts` — byte-identical copy of the kit's bars-replay/v1 SDK shim.
- `LICENSE` — MIT.

[Competition page](https://make.fun/bounty/btc-race-24h-20261111-0801)
