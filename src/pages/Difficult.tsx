import EmptyState from "../components/EmptyState";

// TODO (Fase 11): listar cards com baixa taxa de acerto / muitos "Difícil" (reviews/{uid}).
export default function Difficult() {
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl text-ink-900 dark:text-paper mb-6">Cards difíceis</h1>
      <EmptyState
        title="Nenhum card difícil por aqui"
        description="Cards que você erra com frequência ou marca como difícil aparecem automaticamente nesta lista."
      />
    </div>
  );
}
