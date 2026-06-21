"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface ScoreRadarProps {
  scores: {
    growth_score: number;
    infrastructure_score: number;
    development_score: number;
    liquidity_score: number;
    risk_score: number; // raw risk (inverted for display)
  };
  size?: number;
}

export function ScoreRadar({ scores, size = 280 }: ScoreRadarProps) {
  const data = [
    { subject: "Growth",        value: scores.growth_score,         fullMark: 100 },
    { subject: "Infrastructure",value: scores.infrastructure_score,  fullMark: 100 },
    { subject: "Development",   value: scores.development_score,     fullMark: 100 },
    { subject: "Liquidity",     value: scores.liquidity_score,       fullMark: 100 },
    { subject: "Safety",        value: 100 - scores.risk_score,      fullMark: 100 },
  ];

  return (
    <ResponsiveContainer width="100%" height={size}>
      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
        <PolarGrid stroke="hsl(220 20% 18%)" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fill: "hsl(210 15% 55%)", fontSize: 11, fontFamily: "Inter, sans-serif" }}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(220 28% 10%)",
            border: "1px solid hsl(220 20% 18%)",
            borderRadius: "8px",
            fontSize: "12px",
            color: "hsl(210 20% 92%)",
          }}
          formatter={(v: number) => [`${v}/100`]}
        />
        <Radar
          name="Score"
          dataKey="value"
          stroke="#00E5A0"
          fill="#00E5A0"
          fillOpacity={0.15}
          strokeWidth={2}
          dot={{ fill: "#00E5A0", r: 3 }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
