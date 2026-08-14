import { mockCards } from "../../lib/mockData";

// TODO (Fase 9): substituir mockCards pelo resultado real retornado pela IA
// (validado contra o schema JSON da seção 12 do briefing) e persistir no
// Realtime Database somente após aprovação do usuário.
export default function CreateReview() {
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl text-ink-900 dark:text-paper mb-1">
        Revisar flashcards
      </h1>
      <p className="text-ink-400 mb-6">{mockCards.length} flashcards foram gerados.</p>

      <div className="flex gap-3 mb-6">
        <button className="rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper px-4 py-2 text-sm font-medium">
          Aprovar todos
        </button>
        <button className="rounded-lg border border-ink-200 dark:border-ink-700 px-4 py-2 text-sm font-medium text-ink-700 dark:text-paper">
          Salvar deck
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {mockCards.map((card) => (
          <div
            key={card.id}
            className="rounded-card border border-ink-200/70 dark:border-ink-800 bg-white dark:bg-ink-900 p-5 shadow-card"
          >
            <div className="source-tab text-clinical-600 dark:text-clinical-300">{card.topic}</div>
            <p className="font-medium mt-2 text-ink-900 dark:text-paper">{card.question}</p>
            <p className="text-ink-500 mt-1 text-sm">{card.answer}</p>
            <div className="flex gap-4 mt-4 text-sm">
              <button className="text-clinical-600 dark:text-clinical-300 font-medium">Editar</button>
              <button className="text-ink-400">Excluir</button>
              <button className="text-ink-400 ml-auto">Aprovar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
