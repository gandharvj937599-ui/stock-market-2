import type { NextRequest } from "next/server"
import { backtest, generateSyntheticCandles, type Strategy } from "@/lib/strategy"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const symbol = String(body.symbol || "AAPL")
    const from = String(body.from)
    const to = String(body.to)
    const strategy = body.strategy as Strategy

    if (!from || !to || !strategy) {
      return new Response("Missing params", { status: 400 })
    }

    console.log("[v0] Backtest request", { symbol, from, to, strategyName: strategy.name })

    const candles = generateSyntheticCandles(symbol, from, to, strategy.timeframe)
    const result = backtest(candles, strategy)
    return Response.json(result)
  } catch (e: any) {
    console.log("[v0] Backtest error", e?.message)
    return new Response(e?.message || "Internal error", { status: 500 })
  }
}
