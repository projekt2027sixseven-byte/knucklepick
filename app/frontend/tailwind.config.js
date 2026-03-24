/** @type {import('tailwindcss').Config} */
module.exports = {
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
          gold: "#e4c07a",
          cyan: "#5ee7d9",
          violet: "#a78bfa",
        },
        dream: {
          base: "#0c0618",
          ink: "#140a24",
          surface: "rgba(255,255,255,0.06)",
          line: "rgba(255,255,255,0.1)",
          rose: "#fda4af",
          fuchsia: "#e879f9",
          violet: "#a78bfa",
          coral: "#fb923c",
          sky: "#7dd3fc",
          mint: "#6ee7b7",
        },
        knuckle: {
          bg: "#0c0618",
          void: "#0c0618",
          ink: "#140a24",
          surface: "rgba(255,255,255,0.06)",
          line: "rgba(255,255,255,0.1)",
          primary: "#a78bfa",
          accent: "#f472b6",
          heat: "#fb923c",
          gold: "#fcd34d",
          mist: "rgba(255,255,255,0.04)",
          signal: "#6ee7b7",
          ice: "#7dd3fc",
        },
      },
      ringOffsetColor: {
        knuckle: {
          bg: "#0c0618",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 60px rgba(167, 139, 250, 0.35)",
        "glow-accent": "0 0 48px rgba(244, 114, 182, 0.28)",
        "glow-featured":
          "0 0 80px rgba(232, 121, 249, 0.3), 0 0 100px rgba(251, 146, 60, 0.12), inset 0 1px 0 rgba(255,255,255,0.08)",
        lift: "0 24px 60px rgba(0, 0, 0, 0.55)",
        card: "0 12px 40px rgba(0, 0, 0, 0.45)",
        "card-hover": "0 20px 56px rgba(0, 0, 0, 0.55), 0 0 50px rgba(167, 139, 250, 0.18)",
        dream: "0 8px 32px rgba(88, 28, 135, 0.35), inset 0 1px 0 rgba(255,255,255,0.12)",
      },
      keyframes: {
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "bar-glow": {
          "0%, 100%": { opacity: "0.65" },
          "50%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "dream-blob-a": {
          "0%, 100%": { transform: "translate(0, 0) rotate(0deg) scale(1)" },
          "40%": { transform: "translate(24px, 18px) rotate(6deg) scale(1.04)" },
          "70%": { transform: "translate(-12px, 28px) rotate(-4deg) scale(0.98)" },
        },
        "dream-blob-b": {
          "0%, 100%": { transform: "translate(0, 0) rotate(0deg) scale(1)" },
          "50%": { transform: "translate(-32px, -20px) rotate(-8deg) scale(1.06)" },
        },
        "dream-blob-c": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "45%": { transform: "translate(20px, -24px) scale(1.05)" },
          "80%": { transform: "translate(-16px, 12px) scale(0.97)" },
        },
        "dream-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s ease-in-out infinite",
        "bar-glow": "bar-glow 2.2s ease-in-out infinite",
        float: "float 5s ease-in-out infinite",
        "fade-in": "fade-in 0.5s ease-out both",
        "dream-blob-a": "dream-blob-a 22s ease-in-out infinite",
        "dream-blob-b": "dream-blob-b 28s ease-in-out infinite",
        "dream-blob-c": "dream-blob-c 26s ease-in-out infinite",
        "dream-shift": "dream-shift 14s ease-in-out infinite",
      },
      transitionDuration: {
        400: "400ms",
      },
      backgroundImage: {
        "radial-glow":
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(167,139,250,0.22), transparent 55%)",
        mesh:
          "linear-gradient(135deg, rgba(232,121,249,0.1) 0%, transparent 45%, rgba(251,146,60,0.08) 100%)",
        "dream-text":
          "linear-gradient(120deg, #fda4af 0%, #e879f9 25%, #a78bfa 50%, #7dd3fc 75%, #fb923c 100%)",
      },
      backgroundSize: {
        "dream-wide": "200% 200%",
      },
    },
  },
  plugins: [],
};
