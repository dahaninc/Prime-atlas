"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";

interface ScoreBreakdownProps {
  scores: {
    growth_score: number;
    infrastructure_score: number;
    development_score: number;
    liquidity_score: number;
    risk_score: number;
  };
}

function barColor(score: number) {
  if (score >= 75) return "#00E5A0";
  if (score >= 50) return "#F5A623";
  return "#FF4444";
}

export function ScoreBreakdown({ scores }: ScoreBreakdownProps) {
  const data = [
    { name: "Growth",        score: scores.growth_score },
    { name: "Infra",         score: scores.infrastructure_score },
    { name: "Development",   score: scores.development_score },
    { name: "Liquidity",     score: scores.liquidity_score },
    { name: "Safety",        score: 100 - scores.risk_score },
  ];

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={28}>
        <CartesianGrid vertical={false} stroke="hsl(220 20% 18%)" strokeDasharray="3 3" />
        <XAxis
          dataKey="name"
          tick={{ fill: "hsl(210 15% 55%)", fontSize: 10, fontFamily: "Inter, sans-serif" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "hsl(210 15% 55%)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          ticks={[0, 25, 50, 75, 100]}
        />
        <Tooltip
          cursor={{ fill: "hsl(220 25% 14%)" }}
          contentStyle={{
            background: "hsl(220 28% 10%)",
            border: "1px solid hsl(220 20% 18%)",
            borderRadius: "8px",
            fontSize: "12px",
            color: "hsl(210 20% 92%)",
          }}
          formatter={(v: number) => [`${v}/100`, "Score"]}
        />
        <Bar dataKey="score" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={barColor(entry.score)} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
