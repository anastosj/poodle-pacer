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
        surface: "var(--surface)",
        "surface-tinted": "var(--surface-tinted)",
        ink: {
          DEFAULT: "var(--ink)",
          muted: "var(--ink-muted)",
          soft: "var(--ink-soft)",
          faint: "var(--ink-faint)",
        },
        outline: "var(--outline)",
        border: {
          DEFAULT: "var(--border)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          dark: "var(--primary-dark)",
          soft: "var(--primary-soft)",
        },
        accent: "var(--accent)",
        highlight: "var(--highlight)",
        lilac: "var(--lilac)",
        periwinkle: "var(--periwinkle)",
        "pale-cyan": "var(--pale-cyan)",
        /*
         * Tailwind v3 has no auto-generated utilities for CSS vars, and the
         * Bklit chart components ship v4-style class names. These four are the
         * only ones they actually use; without them the tooltip renders unstyled.
         */
        chart: {
          label: "var(--chart-label)",
          "tooltip-background": "var(--chart-tooltip-background)",
          "tooltip-foreground": "var(--chart-tooltip-foreground)",
          "tooltip-muted": "var(--chart-tooltip-muted)",
        },
        mood: {
          good: "var(--mood-good)",
          okay: "var(--mood-okay)",
          rough: "var(--mood-rough)",
        },
        success: "var(--success)",
        danger: "var(--danger)",
        "danger-ink": "var(--danger-ink)",
        nav: "var(--primary-dark)",
        headband: {
          DEFAULT: "var(--headband)",
          dark: "var(--headband-dark)",
          light: "var(--headband-light)",
        },
        poodle: {
          white: "var(--poodle-white)",
          cream: "var(--poodle-cream)",
          fur: "var(--poodle-fur)",
        },
      },
      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        pouf: "var(--radius-md)",
      },
      borderWidth: {
        3: "3px",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        card: "var(--shadow-card)",
        lifted: "var(--shadow-lifted)",
        hero: "var(--shadow-hero)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Archivo Black", "sans-serif"],
        sans: ["var(--font-body)", "Space Grotesk", "system-ui", "sans-serif"],
      },
      fontSize: {
        display: ["2.5rem", { lineHeight: "1", letterSpacing: "-0.02em" }],
        title: ["1.5rem", { lineHeight: "1.05", letterSpacing: "-0.01em" }],
        body: ["0.9375rem", { lineHeight: "1.45" }],
        meta: ["0.75rem", { lineHeight: "1.3" }],
        overline: ["0.6875rem", { lineHeight: "1.2", letterSpacing: "0.16em" }],
      },
    },
  },
  plugins: [],
};
export default config;
