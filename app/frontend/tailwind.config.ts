import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        pitch: {
          950: "#03140c",
          900: "#052818",
          800: "#0a3d24",
          700: "#0f5132",
        },
        oracle: {
          gold: "#e8c547",
          cyan: "#38e8ff",
          violet: "#9b6bff",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px rgba(56, 232, 255, 0.15)",
      },
    },
  },
  plugins: [],
};

export default config;
