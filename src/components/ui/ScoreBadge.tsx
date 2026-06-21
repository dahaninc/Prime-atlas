import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

function getScoreStyle(score: number) {
  if (score >= 75) return { color: "text-pa-green", bg: "bg-pa-green/10", border: "border-pa-green/30", label: "High" };
  if (score >= 50) return { color: "text-pa-amber", bg: "bg-pa-amber/10", border: "border-pa-amber/30", label: "Medium" };
  return { color: "text-pa-red", bg: "bg-pa-red/10", border: "border-pa-red/30", label: "Low" };
}

export function ScoreBadge({ score, size = "md", showLabel = false, className }: ScoreBadgeProps) {
  const { color, bg, border, label } = getScoreStyle(score);

  const sizeClasses = {
    sm: "text-sm font-bold",
    md: "text-2xl font-bold",
    lg: "text-4xl font-bold",
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className={cn("font-mono", color, sizeClasses[size])}>
        {score}
        <span className="text-xs text-muted-foreground ml-0.5">/100</span>
      </span>
      {showLabel && (
        <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", bg, border, color)}>
          {label}
        </span>
      )}
    </div>
  );
}

/** Mini score bar — shows sub-score breakdown */
export function ScoreBar({ label, score, className }: { label: string; score: number; className?: string }) {
  const { color, bg } = getScoreStyle(score);
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn("text-xs font-mono font-semibold", color)}>{score}</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", bg.replace("/10", "/60"))}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
