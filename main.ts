// BTC Race 24h entry: a long-only mean-reversion dip bot for CBBTC.
//
// Own design (not a kit baseline). The dev window is a slow grind down
// with a sharp dip and a choppy recovery, and every trend-following
// baseline loses on it, so this bot waits for a deep oversold dip and
// rides the recovery instead of chasing 1-minute noise:
//
//   - Entry (flat only): the close sits at least 1.5% below its 360-bar
//     (6-hour) average and ticks up from the previous bar. One deep dip
//     per window is enough: a full-size round trip costs about 26 bps,
//     so entries must catch a move far larger than that.
//   - Late-window entry: if still flat after bar 1,200 and the close is
//     above its 360-bar average and rising over the last hour, buy once
//     so a steadily rising race window is not sat out entirely.
//   - Exit (holding): take profit at +2% over the entry close, stop loss
//     at -1.2%, or a 1.5% trailing stop below the highest close since
//     entry, whichever comes first. Everything is sold at the window end.
//   - One position at most, full equity when it trades.
//   - Deterministic: float64 math only, no clock, no randomness, no env reads.

import { runBars, type Bar, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const SMA_BARS = 360;
const DIP_BPS = 150; // entry: 1.5% below the 360-bar average
const TAKE_PROFIT_BPS = 200; // +2% over the entry close
const STOP_LOSS_BPS = 120; // -1.2% under the entry close
const TRAIL_BPS = 150; // 1.5% below the peak since entry
const LATE_BAR = 1200; // late-window entry starts here
const LATE_RISE_BARS = 60;
const MAX_SLIPPAGE_BPS = 100;

const closes: number[] = [];
let windowSum = 0;
let entryClose: number | null = null;
let peak: number | null = null;

function sma(): number | null {
  if (closes.length < SMA_BARS) return null;
  return windowSum / SMA_BARS;
}

await runBars({
  onBatch(state: BarsState, batch) {
    const bars = batch.bars.filter((b: Bar) => b.symbol === SYMBOL);
    if (bars.length === 0) return [];
    const close = Number(bars[bars.length - 1].c);
    const prevClose = closes.length > 0 ? closes[closes.length - 1] : null;
    closes.push(close);
    windowSum += close;
    if (closes.length > SMA_BARS) windowSum -= closes[closes.length - SMA_BARS - 1];
    const average = sma();

    const held = state.positions.get(SYMBOL);
    if (held !== undefined) {
      if (peak === null || close > peak) peak = close;
      const entry = entryClose ?? close;
      const takeProfit = close * 10000 >= entry * (10000 + TAKE_PROFIT_BPS);
      const stopLoss = close * 10000 <= entry * (10000 - STOP_LOSS_BPS);
      const trailing = peak !== null && close * 10000 <= peak * (10000 - TRAIL_BPS);
      if (takeProfit || stopLoss || trailing) {
        entryClose = null;
        peak = null;
        const sell: SellInput = { side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
        return [sell];
      }
      return [];
    }

    entryClose = null;
    peak = null;
    if (average === null || prevClose === null) return [];
    const dip = close * 10000 <= average * (10000 - DIP_BPS) && close > prevClose;
    const late = closes.length > LATE_BAR && close > average &&
      close > closes[closes.length - LATE_RISE_BARS - 1];
    if (dip || late) {
      let amount = state.cash;
      if (amount <= 0n) return [];
      const room = state.weightRoom(SYMBOL);
      if (amount > room) amount = room;
      if (amount < BigInt(state.hello.fees.min_notional_quote_units)) return [];
      entryClose = close;
      peak = close;
      const buy: BuyInput = { side: 'buy', symbol: SYMBOL, notional_quote_units: amount, max_slippage_bps: MAX_SLIPPAGE_BPS };
      return [buy];
    }
    return [];
  },
});
