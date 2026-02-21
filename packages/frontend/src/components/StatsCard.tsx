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

const accentStyles = {
  primary: {
    iconBg: "bg-primary-500/10",
    iconBorder: "border-primary-500/20",
    changePositive: "text-green-400",
    changeNegative: "text-red-400",
    glow: "group-hover:shadow-primary-500/5",
  },
  accent: {
    iconBg: "bg-accent-500/10",
    iconBorder: "border-accent-500/20",
    changePositive: "text-green-400",
    changeNegative: "text-red-400",
    glow: "group-hover:shadow-accent-500/5",
  },
  green: {
    iconBg: "bg-green-500/10",
    iconBorder: "border-green-500/20",
    changePositive: "text-green-400",
    changeNegative: "text-red-400",
    glow: "group-hover:shadow-green-500/5",
  },
  red: {
    iconBg: "bg-red-500/10",
    iconBorder: "border-red-500/20",
    changePositive: "text-green-400",
    changeNegative: "text-red-400",
    glow: "group-hover:shadow-red-500/5",
  },
};

export default function StatsCard({
  title,
  value,
  subtitle,
  change,
  icon,
  accentColor = "primary",
}: StatsCardProps) {
  const styles = accentStyles[accentColor];

  return (
    <div
      className={`card-hover group ${styles.glow}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className={`w-10 h-10 rounded-xl ${styles.iconBg} border ${styles.iconBorder} flex items-center justify-center`}
        >
          {icon}
        </div>
        {change && (
          <div
            className={`flex items-center space-x-1 text-sm font-medium ${
              change.positive ? styles.changePositive : styles.changeNegative
            }`}
          >
            {change.positive ? (
              <ArrowTrendingUpIcon className="w-4 h-4" />
            ) : (
              <ArrowTrendingDownIcon className="w-4 h-4" />
            )}
            <span>{change.value}</span>
          </div>
        )}
      </div>
      <p className="text-sm text-dark-400 mb-1">{title}</p>
      <p className="text-2xl font-bold text-dark-50 tracking-tight">{value}</p>
      {subtitle && (
        <p className="text-xs text-dark-500 mt-1">{subtitle}</p>
      )}
    </div>
  );
}
