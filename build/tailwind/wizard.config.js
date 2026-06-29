/**
 * Tailwind v3 config for the self-contained Mass Builder wizard
 * (templates/mass_builder_wizard.html + static/js/mass_builder_wizard.js).
 * Mirrors the tokens that used to live in the inline Play-CDN config.
 * The CDN is blocked by our CSP, so utilities are precompiled instead.
 * Rebuild with:  npm run build:wizard-css
 */
module.exports = {
  darkMode: "class",
  // Include the JS so the JIT scanner emits classes built dynamically in code
  // (stepper, song slots, poster grids, receipt buttons, etc.).
  content: [
    "./templates/mass_builder_wizard.html",
    "./static/js/mass_builder_wizard.js",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#ffb4a9",
        "on-primary": "#690002",
        "primary-container": "#a10f0d",
        "on-primary-container": "#ffada2",
        surface: "#1e100e",
        "on-surface": "#f9dcd8",
        "surface-variant": "#42312e",
        "on-surface-variant": "#e3beb9",
        outline: "#aa8984",
        "outline-variant": "#5b403d",
        background: "#1e100e",
        "soft-white": "#F5F5F7",
        "deep-charcoal": "#121212",
        "muted-crimson": "rgba(161, 15, 13, 0.15)",
      },
      spacing: {
        "margin-edge": "40px",
        "container-max": "1440px",
        gutter: "24px",
      },
      maxWidth: {
        "container-max": "1440px",
      },
      fontFamily: {
        "body-lg": ["Hanken Grotesk", "system-ui", "sans-serif"],
        "body-md": ["Hanken Grotesk", "system-ui", "sans-serif"],
        "label-caps": ["JetBrains Mono", "ui-monospace", "monospace"],
        "label-md": ["Hanken Grotesk", "system-ui", "sans-serif"],
        "headline-lg": ["Bricolage Grotesque", "Georgia", "serif"],
        "headline-md": ["Bricolage Grotesque", "Georgia", "serif"],
        "display-xl": ["Bricolage Grotesque", "Georgia", "serif"],
      },
    },
  },
};
