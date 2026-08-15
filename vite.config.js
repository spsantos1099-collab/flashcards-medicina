import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Configuração padrão do Vite para React + TypeScript.
// Nada específico do Firebase/Netlify entra aqui ainda — isso vem na Fase 2 e Fase 15.
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
    },
});
