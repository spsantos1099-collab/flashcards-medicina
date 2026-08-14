import StatCard from "../components/StatCard";
import { useAuth } from "../contexts/AuthContext";
import { useDecks } from "../hooks/useDecks";

export default function Statistics() {
  const { user } = useAuth();
  const { totals } = useDecks(user?.uid);

  return (
    <div className="max-w-5xl">
      <div className="source-tab text-clinical-600 dark:text-clinical-300">DESEMPENHO</div>
      <h1 className="font-display text-2xl text-ink-900 dark:text-paper mt-1 mb-6">Estatísticas</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Cards no fichário" value={totals.totalCards} />
        <StatCard label="Para revisar" value={totals.dueToday} />
        <StatCard label="Estudados hoje" value={0} />
        <StatCard label="Sequência" value="0 dias" />
      </div>

      <div className="mt-8 rounded-card border border-dashed border-ink-200 dark:border-ink-800 px-6 py-8">
        <h2 className="font-display text-xl text-ink-900 dark:text-paper">Seu desempenho aparecerá aqui</h2>
        <p className="text-sm text-ink-400 mt-2 max-w-2xl">
          As métricas de estudo, retenção e sequência serão calculadas a partir das revisões reais. Até lá, o Fichário não exibe estatísticas fictícias.
        </p>
      </div>
    </div>
  );
}
