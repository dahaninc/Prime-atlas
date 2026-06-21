"use client";

import { cn } from "@/lib/utils";

interface GaugeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  label?: string;
}

function scoreGradient(score: number) {
  if (score >= 75) return { stroke: "#00E5A0", text: "text-pa-green", label: "High conviction" };
  if (score >= 50) return { stroke: "#F5A623", text: "text-pa-amber", label: "Medium conviction" };
  return { stroke: "#FF4444", text: "text-pa-red", label: "Low conviction" };
}

export function OpportunityScoreGauge({ score, size = "md", label }: GaugeProps) {
  const { stroke, text, label: convictionLabel } = scoreGradient(score);

  // SVG arc: half-circle gauge
  const radius = 54;
  const cx = 64;
  const cy = 64;
  const circumference = Math.PI * radius; // half circumference
  const dashOffset = circumference - (score / 100) * circumference;

  const sizes = { sm: 100, md: 140, lg: 180 };
  const viewSize = sizes[size];

  return (
    <div className="flex flex-col items-center">
      <svg
        width={viewSize}
        height={viewSize * 0.6}
        viewBox="0 0 128 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Track */}
        <path
          d={`M 10 64 A ${radius} ${radius} 0 0 1 ${cx * 2 - 10} 64`}
          stroke="hsl(220 20% 18%)"
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
        />
        {/* Fill */}
        <path
          d={`M 10 64 A ${radius} ${radius} 0 0 1 ${cx * 2 - 10} 64`}
          stroke={stroke}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          fill="none"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        {/* Score text */}
        <text x="64" y="62" textAnchor="middle" fill="currentColor" fontSize="22" fontWeight="700" fontFamily="JetBrains Mono, monospace" className={text}>
          {score}
        </text>
        <text x="64" y="74" textAnchor="middle" fill="hsl(210 15% 55%)" fontSize="9" fontFamily="Inter, sans-serif">
          /100
        </text>
      </svg>
      <p className={cn("text-xs font-medium mt-1", text)}>{label ?? convictionLabel}</p>
    </div>
  );
}
