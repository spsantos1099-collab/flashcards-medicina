import EmptyState from "../components/EmptyState";

// TODO (Fase 9/10): listar cards marcados como favoritos.
export default function Favorites() {
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl text-ink-900 dark:text-paper mb-6">Favoritos</h1>
      <EmptyState
        title="Nenhum favorito ainda"
        description="Marque cards durante o estudo para encontrá-los rapidamente aqui."
      />
    </div>
  );
}
