"use client"

import { Line, LineChart, Bar, BarChart, XAxis, YAxis, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { TrendingDown, Target, Moon, Smile } from "lucide-react"
import { cn } from "@/lib/utils"

// Dummy data for weight progress
const weightData = [
  { date: "Nov 1", weight: 195, target: 175 },
  { date: "Nov 8", weight: 193, target: 175 },
  { date: "Nov 15", weight: 191, target: 175 },
  { date: "Nov 22", weight: 189, target: 175 },
  { date: "Nov 29", weight: 187, target: 175 },
  { date: "Dec 6", weight: 185, target: 175 },
  { date: "Dec 13", weight: 183, target: 175 },
  { date: "Dec 20", weight: 181, target: 175 },
  { date: "Dec 27", weight: 179, target: 175 },
  { date: "Jan 3", weight: 177, target: 175 },
  { date: "Jan 10", weight: 176, target: 175 },
  { date: "Jan 17", weight: 175, target: 175 },
  { date: "Jan 24", weight: 174, target: 175 },
  { date: "Jan 31", weight: 173, target: 175 },
]

// Dummy data for calorie intake
const calorieData = [
  { day: "Mon", calories: 2100, target: 2000 },
  { day: "Tue", calories: 1950, target: 2000 },
  { day: "Wed", calories: 2200, target: 2000 },
  { day: "Thu", calories: 1850, target: 2000 },
  { day: "Fri", calories: 2050, target: 2000 },
  { day: "Sat", calories: 2300, target: 2000 },
  { day: "Sun", calories: 1900, target: 2000 },
]

// Dummy data for mood and sleep
const moodSleepData = [
  { day: "Jan 15", mood: 7, sleep: 7.2 },
  { day: "Jan 16", mood: 8, sleep: 7.8 },
  { day: "Jan 17", mood: 6, sleep: 6.5 },
  { day: "Jan 18", mood: 9, sleep: 8.2 },
  { day: "Jan 19", mood: 8, sleep: 7.5 },
  { day: "Jan 20", mood: 7, sleep: 6.8 },
  { day: "Jan 21", mood: 9, sleep: 8.5 },
  { day: "Jan 22", mood: 8, sleep: 7.9 },
  { day: "Jan 23", mood: 7, sleep: 7.1 },
  { day: "Jan 24", mood: 9, sleep: 8.3 },
  { day: "Jan 25", mood: 8, sleep: 7.6 },
  { day: "Jan 26", mood: 6, sleep: 6.2 },
  { day: "Jan 27", mood: 8, sleep: 7.8 },
  { day: "Jan 28", mood: 9, sleep: 8.1 },
]

type ChartVariant = "default" | "glass"

type ChartProps = {
  variant?: ChartVariant
}

const glassCardClasses = "relative overflow-hidden border border-white/15 bg-white/10 text-foreground backdrop-blur-2xl shadow-[0_30px_80px_rgba(15,23,42,0.4)]"
const glassTileWrapper = "relative flex w-full items-center justify-center overflow-hidden rounded-[26px] border border-white/15 bg-white/10 p-4 shadow-[0_25px_65px_rgba(15,23,42,0.35)] backdrop-blur-xl [&_.recharts-line]:stroke-[hsl(var(--chart-1))] [&_.recharts-line[stroke='var(--color-target)']]:stroke-[hsl(var(--chart-2))]"
const glassTileWrapperCompact = "relative flex w-full items-center justify-center overflow-hidden rounded-[22px] border border-white/15 bg-white/10 p-3 shadow-[0_18px_45px_rgba(15,23,42,0.3)] backdrop-blur-xl [&_.recharts-bar]:fill-[hsl(var(--chart-3))] [&_.recharts-line]:stroke-[hsl(var(--chart-5))] [&_.recharts-line[stroke='var(--color-sleep)']]:stroke-[hsl(var(--chart-1))]"

export function WeightProgressChart({ variant = "default" }: ChartProps = {}) {
  const isGlass = variant === "glass"
  const chart = (
    <ChartContainer
      config={{
        weight: {
          label: "Current Weight",
          color: "hsl(var(--chart-1))",
        },
        target: {
          label: "Target Weight",
          color: "hsl(var(--chart-2))",
        },
      }}
      className="h-[250px] w-full [&_.recharts-cartesian-axis-tick_text]:fill-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-muted-foreground/30">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={weightData}>
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }} />
          <YAxis
            domain={["dataMin - 2", "dataMax + 2"]}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line
            type="monotone"
            dataKey="weight"
            stroke="var(--color-weight)"
            strokeWidth={3}
            dot={{ fill: "var(--color-weight)", strokeWidth: 2, r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="target"
            stroke="var(--color-target)"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  )

  return (
    <Card className={cn("border-0 shadow-sm", isGlass && glassCardClasses)}>
      <CardHeader className={cn("pb-3", isGlass && "px-8 pb-6 text-left text-muted-foreground")}>
        <div className="flex items-center justify-between">
          <CardTitle className={cn("text-base font-medium", isGlass && "text-foreground")}>Weight Progress</CardTitle>
          <div className={cn("flex items-center text-sm", isGlass ? "text-green-600" : "text-green-600")}>
            <TrendingDown className="w-4 h-4 mr-1" />
            -22 lbs
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn("pt-0", isGlass && "px-8 pb-8")}>
        {isGlass ? <div className={glassTileWrapper}>{chart}</div> : chart}
        <div className={cn(
          "mt-3 flex items-center justify-between text-xs text-muted-foreground",
          isGlass && "mt-6 text-sm text-muted-foreground"
        )}>
          <span>Current: 173 lbs</span>
          <span className="flex items-center">
            <Target className="w-3 h-3 mr-1" />
            Target: 175 lbs
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export function CalorieIntakeChart({ variant = "default" }: ChartProps = {}) {
  const isGlass = variant === "glass"
  const chart = (
    <ChartContainer
      config={{
        calories: {
          label: "Calories",
          color: "hsl(var(--chart-3))",
        },
        target: {
          label: "Target",
          color: "hsl(var(--chart-4))",
        },
      }}
      className="h-[120px] w-full [&_.recharts-cartesian-axis-tick_text]:fill-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-muted-foreground/30">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={calorieData}>
          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--foreground))' }} />
          <YAxis hide />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="calories" fill="var(--color-calories)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )

  return (
    <Card className={cn("border-0 shadow-sm", isGlass && glassCardClasses)}>
      <CardHeader className={cn("pb-3", isGlass && "px-6 pb-5 text-left text-muted-foreground")}>
        <CardTitle className={cn("text-sm font-medium", isGlass && "text-foreground")}>Weekly Calories</CardTitle>
      </CardHeader>
      <CardContent className={cn("pt-0", isGlass && "px-6 pb-6")}>
        {isGlass ? <div className={glassTileWrapperCompact}>{chart}</div> : chart}
        <div className={cn(
          "mt-2 text-xs text-muted-foreground text-center",
          isGlass && "mt-4 text-sm text-muted-foreground"
        )}>
          Avg: 2,050 cal/day
        </div>
      </CardContent>
    </Card>
  )
}

export function MoodSleepChart({ variant = "default" }: ChartProps = {}) {
  const isGlass = variant === "glass"
  const chart = (
    <ChartContainer
      config={{
        mood: {
          label: "Mood",
          color: "hsl(var(--chart-5))",
        },
        sleep: {
          label: "Sleep Hours",
          color: "hsl(var(--chart-1))",
        },
      }}
      className="h-[120px] w-full [&_.recharts-cartesian-axis-tick_text]:fill-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-muted-foreground/30">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={moodSleepData}>
          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--foreground))' }} />
          <YAxis hide />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line
            type="monotone"
            dataKey="mood"
            stroke="var(--color-mood)"
            strokeWidth={2}
            dot={{ fill: "var(--color-mood)", strokeWidth: 2, r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="sleep"
            stroke="var(--color-sleep)"
            strokeWidth={2}
            dot={{ fill: "var(--color-sleep)", strokeWidth: 2, r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  )

  return (
    <Card className={cn("border-0 shadow-sm", isGlass && glassCardClasses)}>
      <CardHeader className={cn("pb-3", isGlass && "px-6 pb-5 text-left text-muted-foreground")}>
        <CardTitle className={cn("text-sm font-medium", isGlass && "text-foreground")}>Mood & Sleep</CardTitle>
      </CardHeader>
      <CardContent className={cn("pt-0", isGlass && "px-6 pb-6")}>
        {isGlass ? <div className={glassTileWrapperCompact}>{chart}</div> : chart}
        <div className={cn(
          "mt-2 flex items-center justify-between text-xs text-muted-foreground",
          isGlass && "mt-4 text-sm text-muted-foreground"
        )}>
          <span className="flex items-center">
            <Smile className="w-3 h-3 mr-1" />
            Mood: 7.9/10
          </span>
          <span className="flex items-center">
            <Moon className="w-3 h-3 mr-1" />
            Sleep: 7.5h
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
