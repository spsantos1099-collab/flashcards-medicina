import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function AuthLayout() {
  const { user, loading } = useAuth();

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Coluna de formulário */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10">
            <span className="font-display text-2xl text-ink-900 dark:text-paper">
              Fichário<span className="text-clinical-500">.</span>
            </span>
            <p className="mt-1 text-sm text-ink-400">Estudo ativo para Medicina</p>
          </div>
          <Outlet />
        </div>
      </div>

      {/* Coluna editorial — mesmo design, agora apresentando o próprio Fichário */}
      <div className="hidden lg:flex flex-col justify-between bg-ink-900 text-paper px-14 py-14 relative overflow-hidden">
        <div className="source-tab text-ink-200">SEU FICHÁRIO DE MEDICINA</div>

        <div className="max-w-md">
          <blockquote className="font-display text-3xl leading-snug">
            Menos tempo organizando.
            <br />
            Mais tempo aprendendo.
          </blockquote>
          <p className="mt-5 text-sm leading-relaxed text-ink-200 max-w-sm">
            Flashcards inteligentes, fontes verificáveis e revisão espaçada em um só lugar.
          </p>
        </div>

        <div className="source-tab text-ink-200">
          SEU MATERIAL · FONTES CONFIÁVEIS · REVISÃO INTELIGENTE
        </div>
      </div>
    </div>
  );
}
