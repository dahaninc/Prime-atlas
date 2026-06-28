import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // prime-atlas palette: deep navy + signal green accent
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // ── Robinhood exact design tokens ──
        // Canvas
        "rh-black":  "#000000",   // primary background
        "rh-white":  "#FFFFFF",   // primary text
        // Signature accent
        "rh-yellow": "#CCFF00",   // Robinhood CTA / brand yellow-green
        // State tokens
        "rh-green":  "#00C805",   // positive / active
        "rh-red":    "#FF3B30",   // negative / loss
        // Surfaces
        "rh-card":   "#18181B",   // card / drawer bg
        "rh-sheet":  "#0C0D14",   // bottom sheet / sidebar
        "rh-hover":  "#27272A",   // hover surface
        // Text
        "rh-muted":  "#A1A1AA",   // secondary text / fine print
        // Legacy aliases (backward compat)
        "pa-navy":   "#000000",
        "pa-navy-800":"#18181B",
        "pa-navy-700":"#27272A",
        "pa-navy-600":"#3F3F46",
        "pa-green":  "#00C805",
        "pa-amber":  "#F5A623",
        "pa-red":    "#FF3B30",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-newsreader)", "Georgia", "serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [animate],
};

export default config;
