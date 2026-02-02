import type { Config } from "tailwindcss";

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
        // Base semantic colors
        border: "#e5e7eb",
        input: "#e5e7eb",
        ring: "#1e3a5f",
        background: "#f9fafb",
        foreground: "#112337",
        // Primary - Parliamentary Blue (distinct from official Riigikogu)
        rk: {
          900: "#0f2744",
          800: "#162f4d",
          700: "#1e3a5f",
          600: "#264571",
          500: "#2d5a87",
          400: "#4a7aa8",
          300: "#7a9fc4",
          200: "#a9c4de",
          100: "#d4e2ef",
          50: "#e8eef4",
        },
        // Neutral - Document-like
        ink: {
          900: "#112337",
          800: "#1f3347",
          700: "#374151",
          600: "#4b5563",
          500: "#6b7280",
          400: "#9ca3af",
          300: "#d1d5db",
          200: "#e5e7eb",
          100: "#f3f4f6",
          50: "#f9fafb",
        },
        // Vote outcomes
        vote: {
          for: "#059669",
          "for-light": "#d1fae5",
          against: "#dc2626",
          "against-light": "#fee2e2",
          abstain: "#d97706",
          "abstain-light": "#fef3c7",
          absent: "#6b7280",
          "absent-light": "#f3f4f6",
        },
        // Confidence levels
        conf: {
          high: "#059669",
          medium: "#d97706",
          low: "#dc2626",
        },
        // Party colors (Estonian parties)
        party: {
          reform: "#FFE200",
          "reform-text": "#000000",
          ekre: "#00529B",
          centre: "#007F5F",
          isamaa: "#009CDE",
          sde: "#E30613",
          eesti200: "#00AEEF",
          other: "#6B7280",
        },
      },
      fontFamily: {
        sans: ["Open Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      borderRadius: {
        sm: "2px",
        DEFAULT: "4px",
        md: "4px",
        lg: "6px",
      },
      boxShadow: {
        // Minimal shadows for institutional feel
        card: "0 1px 3px 0 rgb(0 0 0 / 0.05)",
        dropdown: "0 4px 6px -1px rgb(0 0 0 / 0.07)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
