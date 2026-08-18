/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Papel / fundo — tom de papel de prontuário, não branco puro
        paper: {
          DEFAULT: "#FAF8F4",
          dim: "#F1EEE7",
        },
        // Tinta / texto e fundo do modo escuro — azul-tinta clínico, não preto puro
        ink: {
          50: "#EEF1F6",
          200: "#C4CCDA",
          400: "#5D6B85",
          600: "#33415C",
          800: "#1B2740",
          900: "#101A2E",
          950: "#0A1120",
        },
        // Acento primário — verde clínico, referência a gráficos e prontuários
        clinical: {
          50: "#EEF6F1",
          100: "#D2E8DA",
          300: "#7FB79A",
          500: "#2E7D5B",
          600: "#236047",
          700: "#1B4A38",
        },
        // Acento de atenção — usado só em "Errei" / alertas pontuais
        signal: {
          400: "#C97361",
          600: "#A8503E",
        },
      },
      fontFamily: {
        display: ["\"Fraunces\"", "ui-serif", "Georgia", "serif"],
        body: ["\"Inter\"", "ui-sans-serif", "system-ui", "sans-serif"],
        data: ["\"IBM Plex Mono\"", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 26, 46, 0.04), 0 6px 20px rgba(16, 26, 46, 0.06)",
        cardHover: "0 2px 4px rgba(16, 26, 46, 0.06), 0 12px 28px rgba(16, 26, 46, 0.10)",
      },
      borderRadius: {
        card: "0.875rem",
      },
    },
  },
  plugins: [],
};
