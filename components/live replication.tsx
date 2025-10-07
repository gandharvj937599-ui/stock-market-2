"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Line, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import { type Strategy, type Candle, evaluateStrategyStep, nextSyntheticCandle } from "@/lib/strategy"

type Props = { initialStrategy?: Strategy }

export function LiveReplication({ initialStrategy }: Props) {
  const [running, setRunning] = useState(false)
  const [symbol, setSymbol] = useState("AAPL")
  const [strategy, setStrategy] = useState<Strategy | undefined>(initialStrategy)
  const [candles, setCandles] = useState<Candle[]>(() => seedCandles(symbol))
  const [equity, setEquity] = useState<number>(10000)
  const [position, setPosition] = useState<{ side: "flat" | "long"; entry?: number }>({ side: "flat" })
  const timer = useRef<any>(null)

  useEffect(() => {
    setCandles(seedCandles(symbol))
    setEquity(10000)
    setPosition({ side: "flat" })
  }, [symbol])

  useEffect(() => {
    if (!running) {
      if (timer.current) clearInterval(timer.current)
      return
    }
    timer.current = setInterval(() => {
      setCandles((cs) => {
        const next = nextSyntheticCandle(cs[cs.length - 1], symbol, "1m")
        const arr = [...cs.slice(-200), next]
        return arr
      })
    }, 1000)

    return () => clearInterval(timer.current)
  }, [running, symbol])

  useEffect(() => {
    if (!strategy) return
    const last = candles[candles.length - 1]
    if (!last) return
    const prev = candles[candles.length - 2]
    const act = evaluateStrategyStep(candles, candles.length - 1, strategy, prev)
    if (act === "enter-long" && position.side === "flat") {
      setPosition({ side: "long", entry: last.close })
    }
    if (act === "exit" && position.side === "long") {
      const pnl = (last.close - (position.entry || last.close)) / (position.entry || last.close)
      setEquity((e) => e * (1 + pnl))
      setPosition({ side: "flat" })
    }
  }, [candles, strategy]) // evaluate each tick

  const series = useMemo(() => candles.map((c, i) => ({ t: i, price: c.close })), [candles])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Replication (Simulated)</CardTitle>
        <CardDescription>Simulates real-time ticks to test your strategy loop and state.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>Symbol</Label>
            <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
          </div>
          <div className="md:col-span-3 flex items-end gap-3">
            <Button onClick={() => setRunning((r) => !r)}>{running ? "Stop" : "Start"}</Button>
            <div className="rounded-md bg-secondary px-3 py-2">
              <div className="text-xs text-muted-foreground">Equity</div>
              <div className="text-lg font-semibold">{equity.toFixed(2)}</div>
            </div>
            <div className="rounded-md bg-secondary px-3 py-2">
              <div className="text-xs text-muted-foreground">Position</div>
              <div className="text-lg font-semibold">{position.side}</div>
            </div>
          </div>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="t" tick={{ fill: "var(--color-muted-foreground)" }} />
              <YAxis tick={{ fill: "var(--color-muted-foreground)" }} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-foreground)",
                }}
              />
              <Line type="monotone" dataKey="price" stroke="var(--color-chart-1)" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

function seedCandles(symbol: string) {
  const now = Date.now()
  const arr: Candle[] = []
  const base = 100 + (symbol.charCodeAt(0) % 10)
  for (let i = 0; i < 200; i++) {
    const noise = (Math.sin(i / 7) + Math.cos(i / 11)) * 0.2
    const drift = 0.02
    const close = Math.max(1, base + noise + drift * i)
    arr.push({
      t: new Date(now - (200 - i) * 60_000).toISOString(),
      open: close * 0.995,
      high: close * 1.004,
      low: close * 0.996,
      close,
      volume: 1000 + i,
    })
  }
  return arr
}
