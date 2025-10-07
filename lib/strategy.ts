export type IndicatorType = "Price" | "SMA" | "EMA" | "RSI"
export type Operator = ">" | "<" | ">=" | "<=" | "crossesAbove" | "crossesBelow"

export type IndicatorRef = {
  type: IndicatorType
  params?: { period?: number }
}

export type Condition = {
  id?: string
  left: IndicatorRef
  operator: Operator
  right: IndicatorRef | number
}

export type Strategy = {
  name: string
  timeframe: "1m" | "5m" | "1h" | "1d"
  takeProfitPct?: number
  stopLossPct?: number
  entry: Condition[]
  exit: Condition[]
}

export type Candle = {
  t: string // ISO time
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export function defaultStrategy(): Strategy {
  return {
    name: "Price Above SMA 20; Exit on cross below",
    timeframe: "1m",
    takeProfitPct: 2,
    stopLossPct: 1,
    entry: [
      {
        id: cryptoRandomId(),
        left: { type: "Price", params: {} },
        operator: "crossesAbove",
        right: { type: "SMA", params: { period: 20 } },
      },
    ],
    exit: [
      {
        id: cryptoRandomId(),
        left: { type: "Price", params: {} },
        operator: "crossesBelow",
        right: { type: "SMA", params: { period: 20 } },
      },
    ],
  }
}

// Storage
const KEY = "v0.strategy.current"
export function saveStrategy(s: Strategy) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch (e) {
    console.log("[v0] Failed to save strategy", e)
  }
}
export function loadStrategy(): Strategy | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function cryptoRandomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2)
}

// Indicators
export function sma(values: number[], period: number, i: number) {
  if (i + 1 < period) return Number.NaN
  let sum = 0
  for (let k = i; k > i - period; k--) sum += values[k]
  return sum / period
}

export function ema(values: number[], period: number, i: number, prevEma?: number) {
  const k = 2 / (period + 1)
  const price = values[i]
  if (i === 0 || !isFinite(prevEma as number)) return price
  return price * k + (prevEma as number) * (1 - k)
}

export function rsi(values: number[], period: number, i: number, prev?: { avgGain: number; avgLoss: number }) {
  if (i === 0) return Number.NaN
  const change = values[i] - values[i - 1]
  const gain = Math.max(0, change)
  const loss = Math.max(0, -change)
  if (!prev) {
    // seed
    if (i < period) return Number.NaN
    let g = 0,
      l = 0
    for (let k = i - period + 1; k <= i; k++) {
      const ch = values[k] - values[k - 1]
      g += Math.max(0, ch)
      l += Math.max(0, -ch)
    }
    const avgGain = g / period
    const avgLoss = l / period
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    return 100 - 100 / (1 + rs)
  } else {
    const avgGain = (prev.avgGain * (period - 1) + gain) / period
    const avgLoss = (prev.avgLoss * (period - 1) + loss) / period
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    return 100 - 100 / (1 + rs)
  }
}

function getValue(candles: Candle[], i: number, ref: IndicatorRef, caches: any) {
  const closes = caches.closes || (caches.closes = candles.map((c) => c.close))
  switch (ref.type) {
    case "Price":
      return candles[i].close
    case "SMA": {
      const p = ref.params?.period || 20
      caches.sma = caches.sma || {}
      caches.sma[p] = caches.sma[p] || []
      if (!isFinite(caches.sma[p][i])) caches.sma[p][i] = sma(closes, p, i)
      return caches.sma[p][i]
    }
    case "EMA": {
      const p = ref.params?.period || 20
      caches.ema = caches.ema || {}
      caches.ema[p] = caches.ema[p] || []
      if (!isFinite(caches.ema[p][i])) {
        const prev = i > 0 ? caches.ema[p][i - 1] : undefined
        caches.ema[p][i] = ema(closes, p, i, prev)
      }
      return caches.ema[p][i]
    }
    case "RSI": {
      const p = ref.params?.period || 14
      caches.rsi = caches.rsi || {}
      caches.rsi[p] = caches.rsi[p] || []
      if (!isFinite(caches.rsi[p][i])) {
        // approximate prev state from last value
        const prevVal = i > 0 ? caches.rsi[p][i - 1] : undefined
        caches.rsi[p][i] = rsi(closes, p, i, prevVal ? { avgGain: 0, avgLoss: 0 } : undefined)
      }
      return caches.rsi[p][i]
    }
  }
}

function compare(op: Operator, prevL: number, prevR: number, L: number, R: number) {
  switch (op) {
    case ">":
      return L > R
    case "<":
      return L < R
    case ">=":
      return L >= R
    case "<=":
      return L <= R
    case "crossesAbove":
      return prevL <= prevR && L > R
    case "crossesBelow":
      return prevL >= prevR && L < R
  }
}

export function evaluateStrategyStep(
  candles: Candle[],
  i: number,
  strategy: Strategy,
  prevCandle?: Candle,
): "enter-long" | "exit" | "hold" {
  const caches: any = {}
  const prevIdx = Math.max(0, i - 1)
  const allEntry = strategy.entry.every((cond) => {
    const L = getValue(candles, i, cond.left, caches)
    const prevL = getValue(candles, prevIdx, cond.left, caches)
    const rightVal = typeof cond.right === "number" ? cond.right : getValue(candles, i, cond.right, caches)
    const prevRight = typeof cond.right === "number" ? cond.right : getValue(candles, prevIdx, cond.right, caches)
    return compare(cond.operator, prevL, prevRight, L, rightVal as number)
  })

  if (allEntry) return "enter-long"

  const anyExit = strategy.exit.some((cond) => {
    const L = getValue(candles, i, cond.left, caches)
    const prevL = getValue(candles, prevIdx, cond.left, caches)
    const rightVal = typeof cond.right === "number" ? cond.right : getValue(candles, i, cond.right, caches)
    const prevRight = typeof cond.right === "number" ? cond.right : getValue(candles, prevIdx, cond.right, caches)
    return compare(cond.operator, prevL, prevRight, L, rightVal as number)
  })

  if (anyExit) return "exit"
  return "hold"
}

export function backtest(candles: Candle[], strategy: Strategy) {
  let equity = 10000
  let entryPrice: number | null = null
  const equitySeries: { t: string; equity: number }[] = []
  const trades: { entryTime: string; exitTime: string; entry: number; exit: number; pnlPct: number }[] = []
  let peak = equity
  let maxDrawdown = 0

  for (let i = 0; i < candles.length; i++) {
    const action = evaluateStrategyStep(candles, i, strategy)
    const price = candles[i].close

    if (entryPrice == null && action === "enter-long") {
      entryPrice = price
    }

    if (entryPrice != null) {
      const tp = strategy.takeProfitPct ?? 2
      const sl = strategy.stopLossPct ?? 1
      const changePct = ((price - entryPrice) / entryPrice) * 100
      if (changePct >= tp || changePct <= -sl || action === "exit") {
        const pnl = (price - entryPrice) / entryPrice
        equity = equity * (1 + pnl)
        trades.push({
          entryTime: candles[i].t,
          exitTime: candles[i].t,
          entry: entryPrice,
          exit: price,
          pnlPct: pnl * 100,
        })
        entryPrice = null
      }
    }

    peak = Math.max(peak, equity)
    const dd = (peak - equity) / peak
    maxDrawdown = Math.max(maxDrawdown, dd)

    equitySeries.push({ t: candles[i].t.slice(5, 16), equity })
  }

  const wins = trades.filter((t) => t.pnlPct > 0).length
  const metrics = {
    totalReturnPct: ((equity - 10000) / 10000) * 100,
    winRate: trades.length ? wins / trades.length : 0,
    maxDrawdownPct: maxDrawdown * 100,
  }

  // Precompute some overlays
  const closes = candles.map((c) => c.close)
  const withOverlays = candles.map((c, i) => ({
    ...c,
    sma20: sma(closes, 20, i),
    sma50: sma(closes, 50, i),
  }))

  return { equity: equitySeries, trades, metrics, candles: withOverlays }
}

// Synthetic candles for demo + live sim
export function generateSyntheticCandles(
  symbol: string,
  fromISO: string,
  toISO: string,
  timeframe: Strategy["timeframe"],
): Candle[] {
  const from = new Date(fromISO).getTime()
  const to = new Date(toISO).getTime()
  const step = timeframe === "1m" ? 60_000 : timeframe === "5m" ? 300_000 : timeframe === "1h" ? 3_600_000 : 86_400_000
  const base = 100 + (symbol.charCodeAt(0) % 10)
  const out: Candle[] = []
  let lastClose = base
  for (let t = from; t <= to; t += step) {
    const i = out.length
    const drift = 0.0005
    const noise = Math.sin(i / 7) * 0.2 + Math.cos(i / 13) * 0.15
    const close = Math.max(1, lastClose * (1 + drift + noise * 0.001))
    const high = Math.max(close, lastClose) * (1 + 0.002)
    const low = Math.min(close, lastClose) * (1 - 0.002)
    const open = lastClose
    out.push({ t: new Date(t).toISOString(), open, high, low, close, volume: 1000 + i })
    lastClose = close
  }
  return out
}

export function nextSyntheticCandle(prev: Candle, symbol: string, timeframe: Strategy["timeframe"]): Candle {
  const step = timeframe === "1m" ? 60_000 : timeframe === "5m" ? 300_000 : timeframe === "1h" ? 3_600_000 : 86_400_000
  const i = Math.floor(Date.now() / step)
  const noise = (Math.sin(i / 5) + Math.cos(i / 9)) * 0.001
  const close = Math.max(1, prev.close * (1 + 0.0005 + noise))
  return {
    t: new Date(new Date(prev.t).getTime() + step).toISOString(),
    open: prev.close,
    high: Math.max(prev.close, close) * 1.002,
    low: Math.min(prev.close, close) * 0.998,
    close,
    volume: prev.volume * (0.98 + Math.random() * 0.04),
  }
}
