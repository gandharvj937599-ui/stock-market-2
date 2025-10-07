"use client"

import useSWRMutation from "swr/mutation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ComposedChart,
  Area,
} from "recharts"
import type { Strategy } from "@/lib/strategy"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Props = {
  initialStrategy?: Strategy
}

async function postJSON(url: string, { arg }: { arg: any }) {
  const res = await fetch(url, {
    method: "POST",
    body: JSON.stringify(arg),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || "Request failed")
  }
  return res.json()
}

export function BacktestRunner({ initialStrategy }: Props) {
  const [symbol, setSymbol] = useState("AAPL")
  const [from, setFrom] = useState<string>(() =>
    new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString().slice(0, 10),
  )
  const [to, setTo] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [strategy, setStrategy] = useState<Strategy | undefined>(initialStrategy)

  const { trigger, isMutating, data, error } = useSWRMutation("/api/backtest", postJSON)

  const onRun = async () => {
    if (!strategy) return
    console.log("[v0] Backtest starting", { symbol, from, to })
    await trigger({ symbol, from, to, strategy })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backtest</CardTitle>
        <CardDescription>Run the saved strategy on historical data.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <Label>Symbol</Label>
            <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
          </div>
          <div>
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Strategy JSON (read-only)</Label>
            <Input readOnly value={strategy ? strategy.name : "No strategy saved"} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button disabled={!strategy || isMutating} onClick={onRun}>
            {isMutating ? "Running..." : "Run Backtest"}
          </Button>
          {error && <span className="text-destructive">Error: {(error as any)?.message}</span>}
        </div>

        {data && (
          <div className="space-y-6">
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Summary</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <Metric label="Total Return" value={`${(data.metrics.totalReturnPct).toFixed(2)}%`} />
                  <Metric label="Win Rate" value={`${(data.metrics.winRate * 100).toFixed(1)}%`} />
                  <Metric label="Trades" value={String(data.trades.length)} />
                  <Metric label="Max Drawdown" value={`${(data.metrics.maxDrawdownPct).toFixed(2)}%`} />
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Equity Curve</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.equity}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="t" tick={{ fill: "var(--color-muted-foreground)" }} />
                      <YAxis tick={{ fill: "var(--color-muted-foreground)" }} domain={["auto", "auto"]} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-card)",
                          border: "1px solid var(--color-border)",
                          color: "var(--color-foreground)",
                        }}
                      />
                      <Line type="monotone" dataKey="equity" stroke="var(--color-chart-1)" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </section>

            <Separator />

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Price & SMA Overlay</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.candles}>
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
                      <Area type="monotone" dataKey="close" stroke="var(--color-chart-2)" fill="var(--color-muted)" />
                      <Line type="monotone" dataKey="sma20" stroke="var(--color-chart-3)" dot={false} />
                      <Line type="monotone" dataKey="sma50" stroke="var(--color-chart-4)" dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Trades</CardTitle>
                </CardHeader>
                <CardContent className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Entry Time</TableHead>
                        <TableHead>Exit Time</TableHead>
                        <TableHead>Entry</TableHead>
                        <TableHead>Exit</TableHead>
                        <TableHead>PnL %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.trades.map((tr: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>{tr.entryTime}</TableCell>
                          <TableCell>{tr.exitTime}</TableCell>
                          <TableCell>{tr.entry.toFixed(2)}</TableCell>
                          <TableCell>{tr.exit.toFixed(2)}</TableCell>
                          <TableCell className={tr.pnlPct >= 0 ? "text-green-600" : "text-red-600"}>
                            {tr.pnlPct.toFixed(2)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  )
}
