"use client";

import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from "@heroicons/react/24/outline";

interface StatsCardProps {
  title: string;
  value: string;
  subtitle?: string;
  change?: {
    value: string;
    positive: boolean;
  };
  icon?: React.ReactNode;
  accentColor?: "primary" | "accent" | "green" | "red";
}

export default function StatsCard({
  title,
  value,
  subtitle,
  change,
}: StatsCardProps) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.15em] text-text-2 font-display mb-1.5">
        {title}
      </p>
      <p className="text-2xl sm:text-3xl font-mono font-semibold text-text-0 tracking-tight">
        {value}
      </p>
      <div className="flex items-center gap-3 mt-1">
        {subtitle && (
          <p className="text-xs text-text-2">{subtitle}</p>
        )}
        {change && (
          <span
            className={`inline-flex items-center gap-1 text-xs font-mono ${
              change.positive ? "text-success" : "text-danger"
            }`}
          >
            {change.positive ? (
              <ArrowTrendingUpIcon className="w-3 h-3" />
            ) : (
              <ArrowTrendingDownIcon className="w-3 h-3" />
            )}
            {change.value}
          </span>
        )}
      </div>
    </div>
  );
}
