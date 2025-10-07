"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StrategyBuilder } from "@/components/strategy-builder"
import { BacktestRunner } from "@/components/backtest-runner"
import { LiveReplication } from "@/components/live-replication"
import { loadStrategy } from "@/lib/strategy"

export default function HomePage() {
  const [strategyVersion, setStrategyVersion] = useState(0)

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-semibold text-balance">Self-Empowered AI: Strategy Studio</h1>
        <p className="text-muted-foreground text-pretty">
          Define custom trading strategies without code, then backtest on history and replicate in real time.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>
            Create your strategy, validate it on historical data, and simulate live replication.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="strategy" className="w-full">
            <TabsList>
              <TabsTrigger value="strategy">Strategy Builder</TabsTrigger>
              <TabsTrigger value="backtest">Backtest</TabsTrigger>
              <TabsTrigger value="live">Live</TabsTrigger>
            </TabsList>

            <TabsContent value="strategy" className="pt-4">
              <StrategyBuilder
                onSaved={() => {
                  setStrategyVersion((v) => v + 1)
                }}
              />
            </TabsContent>

            <TabsContent value="backtest" className="pt-4">
              <BacktestRunner key={strategyVersion} initialStrategy={loadStrategy() || undefined} />
            </TabsContent>

            <TabsContent value="live" className="pt-4">
              <LiveReplication key={strategyVersion} initialStrategy={loadStrategy() || undefined} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  )
}
