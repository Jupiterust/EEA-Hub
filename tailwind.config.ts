import type { Config } from "tailwindcss";

const config: Config = {
  theme: {
    extend: {
      colors: {
        bg: "#212733",
        surface: "#2A3140",
        elevated: "#333B4C",
        border: "#3A4250",
        "text-primary": "#E8ECF1",
        "text-secondary": "#9AA4B2",
        primary: "#4FD1C5",
        secondary: "#7CCACD",
        accent: "#6D96B4",
        success: "#6DAB70",
        gold: "#C4AC60",
        danger: "#D97676",
      },
    },
  },
};

export default config;
