import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        headband: {
          DEFAULT: "#2f6fed",
          dark: "#1d4ed8",
          light: "#e3ecfd",
        },
        poodle: {
          white: "#fdfcf9",
          cream: "#f5f2ec",
          fur: "#d9d2c4",
        },
      },
      borderRadius: {
        pouf: "1.75rem",
      },
    },
  },
  plugins: [],
};
export default config;
