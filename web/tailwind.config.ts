import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#090b10",
        panel: "#0f131b",
        "panel-2": "#151b26",
        edge: "#212a3a",
        "edge-strong": "#2d3a4f",
        accent: "#5eead4",
        "accent-strong": "#2dd4bf",
        muted: "#8b94a7",
        faint: "#5b6474",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(0 0 0 / 0.4)",
        pop: "0 8px 30px rgb(0 0 0 / 0.45)",
        glow: "0 0 24px rgb(94 234 212 / 0.12)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.35s ease-out both",
        "pulse-dot": "pulse-dot 1.6s ease-in-out infinite",
        shimmer: "shimmer 1.8s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
