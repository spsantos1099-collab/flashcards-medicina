import StudyCard from "../components/StudyCard";
import { mockCards } from "../lib/mockData";

// TODO (Fase 11): substituir mockCards[0] pela fila real de revisão do dia,
// calculada pelo algoritmo de repetição espaçada.
export default function Study() {
  const card = mockCards[0];

  return (
    <div>
      <div className="max-w-xl mx-auto mb-6">
        <div className="h-1.5 rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden">
          <div className="h-full w-1/4 bg-clinical-500" />
        </div>
      </div>
      <StudyCard card={card} />
    </div>
  );
}
