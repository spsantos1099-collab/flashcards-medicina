import StatCard from "../components/StatCard";
import { mockSummary } from "../lib/mockData";

// TODO (Fase 12): calcular métricas reais a partir de studySessions/{uid} e reviews/{uid}.
export default function Statistics() {
  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl text-ink-900 dark:text-paper mb-6">Desempenho</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Estudados hoje" value={mockSummary.studiedToday} />
        <StatCard label="Sequência" value={`${mockSummary.streakDays} dias`} />
        <StatCard label="Taxa de acerto" value="—" hint="Disponível após a primeira sessão" />
        <StatCard label="Tempo de estudo" value="—" hint="Disponível após a primeira sessão" />
      </div>
      <div className="rounded-card border border-dashed border-ink-200 dark:border-ink-800 py-16 text-center text-ink-400">
        Gráficos de evolução chegam na Fase 12, junto com os dados reais de estudo.
      </div>
    </div>
  );
}
