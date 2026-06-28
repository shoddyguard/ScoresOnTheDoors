import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Scoring colour tokens
        "score-green": {
          DEFAULT: "#16a34a",
          light: "#dcfce7",
        },
        "score-amber": {
          DEFAULT: "#d97706",
          light: "#fef3c7",
        },
        "score-red": {
          DEFAULT: "#dc2626",
          light: "#fee2e2",
        },
      },
    },
  },
  plugins: [forms],
};

export default config;
