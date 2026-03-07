import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/providers/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        surface: {
          0: "hsl(var(--surface-0) / <alpha-value>)",
          1: "hsl(var(--surface-1) / <alpha-value>)",
          2: "hsl(var(--surface-2) / <alpha-value>)",
        },
        border: "hsl(var(--border) / <alpha-value>)",
        text: {
          0: "hsl(var(--text-0) / <alpha-value>)",
          1: "hsl(var(--text-1) / <alpha-value>)",
          2: "hsl(var(--text-2) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          dim: "hsl(var(--accent-dim) / <alpha-value>)",
        },
        success: "hsl(var(--success) / <alpha-value>)",
        danger: "hsl(var(--danger) / <alpha-value>)",
      },
      animation: {
        "fade-up": "fadeUp 0.4s ease-out both",
        "moon-glow": "moonGlow 4s ease-in-out infinite",
        "pulse-dot": "pulseDot 2s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        moonGlow: {
          "0%, 100%": {
            filter: "drop-shadow(0 0 6px hsla(38, 92%, 50%, 0.12))",
          },
          "50%": {
            filter: "drop-shadow(0 0 18px hsla(38, 92%, 50%, 0.28))",
          },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
    },
  },
  plugins: [
    plugin(function ({ addUtilities }) {
      const delays: Record<string, Record<string, string>> = {};
      for (let i = 1; i <= 10; i++) {
        delays[`.delay-${i}`] = {
          "animation-delay": `${i * 80}ms`,
        };
      }
      addUtilities(delays);
    }),
  ],
};

export default config;
