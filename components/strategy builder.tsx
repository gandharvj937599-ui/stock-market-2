"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  saveStrategy,
  loadStrategy,
  type IndicatorType,
  type Operator,
  type Strategy,
  defaultStrategy,
} from "@/lib/strategy"
import { cn } from "@/lib/utils"

type Props = { onSaved?: () => void }

type EditableCondition = Strategy["entry"][number] & { id: string }

const indicatorTypes: IndicatorType[] = ["Price", "SMA", "EMA", "RSI"]

const operators: Operator[] = [">", "<", ">=", "<=", "crossesAbove", "crossesBelow"]

function ConditionRow({
  c,
  onChange,
  onRemove,
}: {
  c: EditableCondition
  onChange: (next: EditableCondition) => void
  onRemove: () => void
}) {
  const isCross = c.operator === "crossesAbove" || c.operator === "crossesBelow"

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
      <div className="md:col-span-2">
        <Label>Left</Label>
        <Select value={c.left.type} onValueChange={(v) => onChange({ ...c, left: { ...c.left, type: v as any } })}>
          <SelectTrigger>
            <SelectValue placeholder="Indicator" />
          </SelectTrigger>
          <SelectContent>
            {indicatorTypes.map((it) => (
              <SelectItem key={it} value={it}>
                {it}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(c.left.type === "SMA" || c.left.type === "EMA") && (
        <div className="md:col-span-2">
          <Label>Left Period</Label>
          <Input
            type="number"
            min={1}
            value={c.left.params?.period ?? 20}
            onChange={(e) => onChange({ ...c, left: { ...c.left, params: { period: Number(e.target.value) } } })}
          />
        </div>
      )}
      {c.left.type === "RSI" && (
        <div className="md:col-span-2">
          <Label>Left Period</Label>
          <Input
            type="number"
            min={1}
            value={c.left.params?.period ?? 14}
            onChange={(e) => onChange({ ...c, left: { ...c.left, params: { period: Number(e.target.value) } } })}
          />
        </div>
      )}

      <div className="md:col-span-2">
        <Label>Operator</Label>
        <Select value={c.operator} onValueChange={(v) => onChange({ ...c, operator: v as Operator })}>
          <SelectTrigger>
            <SelectValue placeholder="Operator" />
          </SelectTrigger>
          <SelectContent>
            {operators.map((op) => (
              <SelectItem key={op} value={op}>
                {op}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={cn("md:col-span-2", isCross && "opacity-60")}>
        <Label>Right</Label>
        <Select
          value={typeof c.right === "number" ? "number" : c.right.type}
          onValueChange={(v) => {
            if (v === "number") onChange({ ...c, right: 0 })
            else onChange({ ...c, right: { type: v as any, params: {} } })
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Compare to" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="number">Number</SelectItem>
            {indicatorTypes.map((it) => (
              <SelectItem key={it} value={it}>
                {it}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {typeof c.right !== "number" && (c.right.type === "SMA" || c.right.type === "EMA") && (
        <div className="md:col-span-2">
          <Label>Right Period</Label>
          <Input
            type="number"
            min={1}
            value={c.right.params?.period ?? 50}
            onChange={(e) =>
              onChange({
                ...c,
                right: { ...c.right, params: { period: Number(e.target.value) } },
              })
            }
          />
        </div>
      )}
      {typeof c.right === "number" && !isCross && (
        <div className="md:col-span-2">
          <Label>Right Value</Label>
          <Input type="number" value={c.right} onChange={(e) => onChange({ ...c, right: Number(e.target.value) })} />
        </div>
      )}

      <div className="md:col-span-2">
        <Button variant="destructive" onClick={onRemove}>
          Remove
        </Button>
      </div>
    </div>
  )
}

export function StrategyBuilder({ onSaved }: Props) {
  const [strategy, setStrategy] = useState<Strategy>(() => loadStrategy() ?? defaultStrategy())

  useEffect(() => {
    // Keep ephemeral draft synced with storage loads outside builder
  }, [])

  const addCondition = (key: "entry" | "exit") => {
    setStrategy((s) => ({
      ...s,
      [key]: [
        ...s[key],
        {
          id: crypto.randomUUID(),
          left: { type: "Price", params: {} },
          operator: ">",
          right: 0,
        } as any,
      ],
    }))
  }

  const removeCondition = (key: "entry" | "exit", id: string) => {
    setStrategy((s) => ({ ...s, [key]: s[key].filter((c: any) => c.id !== id) as any }))
  }

  const onSave = () => {
    saveStrategy(strategy)
    onSaved?.()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Define Strategy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <Label>Strategy Name</Label>
            <Input value={strategy.name} onChange={(e) => setStrategy({ ...strategy, name: e.target.value })} />
          </div>
          <div>
            <Label>Timeframe</Label>
            <Select value={strategy.timeframe} onValueChange={(v) => setStrategy({ ...strategy, timeframe: v as any })}>
              <SelectTrigger>
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1m">1m</SelectItem>
                <SelectItem value="5m">5m</SelectItem>
                <SelectItem value="1h">1h</SelectItem>
                <SelectItem value="1d">1d</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Take Profit (%)</Label>
              <Input
                type="number"
                value={strategy.takeProfitPct ?? 2}
                onChange={(e) => setStrategy({ ...strategy, takeProfitPct: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Stop Loss (%)</Label>
              <Input
                type="number"
                value={strategy.stopLossPct ?? 1}
                onChange={(e) => setStrategy({ ...strategy, stopLossPct: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-medium">Entry Conditions</h3>
            <Badge variant="secondary">All must be true</Badge>
          </div>
          <div className="space-y-3">
            {strategy.entry.map((c: any) => (
              <ConditionRow
                key={c.id}
                c={c}
                onChange={(next) =>
                  setStrategy((s) => ({
                    ...s,
                    entry: s.entry.map((x: any) => (x.id === c.id ? next : x)),
                  }))
                }
                onRemove={() => removeCondition("entry", c.id)}
              />
            ))}
            <Button onClick={() => addCondition("entry")}>Add Entry Condition</Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-medium">Exit Conditions</h3>
            <Badge variant="secondary">Any triggers exit</Badge>
          </div>
          <div className="space-y-3">
            {strategy.exit.map((c: any) => (
              <ConditionRow
                key={c.id}
                c={c}
                onChange={(next) =>
                  setStrategy((s) => ({
                    ...s,
                    exit: s.exit.map((x: any) => (x.id === c.id ? next : x)),
                  }))
                }
                onRemove={() => removeCondition("exit", c.id)}
              />
            ))}
            <Button variant="outline" onClick={() => addCondition("exit")}>
              Add Exit Condition
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={onSave}>Save Strategy</Button>
          <Button
            variant="secondary"
            onClick={() => {
              const preset = defaultStrategy()
              setStrategy(preset)
            }}
          >
            Reset to Preset
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
