import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          ink: "#10131A",
          slate: "#2B3240",
          sand: "#F2E9DB",
          accent: "#D9531E",
          cyan: "#3EA8A8"
        }
      },
      fontFamily: {
        display: ["'Bebas Neue'", "Impact", "sans-serif"],
        body: ["'Manrope'", "sans-serif"]
      },
      boxShadow: {
        card: "0 10px 28px rgba(16, 19, 26, 0.12)"
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        rise: "rise 450ms ease both"
      }
    }
  },
  plugins: []
};

export default config;
