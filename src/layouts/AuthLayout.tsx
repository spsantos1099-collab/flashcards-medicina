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

      {/* Coluna editorial — citação/contexto, escondida no mobile */}
      <div className="hidden lg:flex flex-col justify-between bg-ink-900 text-paper px-14 py-14 relative overflow-hidden">
        <div className="source-tab text-ink-200">Cardiologia · Insuficiência Cardíaca</div>
        <blockquote className="font-display text-3xl leading-snug max-w-md">
          "FEVE ≤ 40% define a insuficiência cardíaca com fração de ejeção reduzida."
        </blockquote>
        <div className="source-tab text-ink-200">
          Fonte · Diretriz Brasileira de IC · p. 18
        </div>
      </div>
    </div>
  );
}
