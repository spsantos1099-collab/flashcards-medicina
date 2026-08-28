import type { ExtractedDocument, Flashcard } from "../types";

export interface ReadyFlashcardDetection {
  detected: boolean;
  cards: Flashcard[];
  pairCount: number;
  confidence: "high" | "medium" | "low";
}

function tempId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function clean(value: string) {
  return value.replace(/\*\*/g, "").replace(/__/g, "").replace(/\s+/g, " ").trim();
}

function headingFromLine(line: string) {
  return clean(line.replace(/^(?:--)?#{1,6}\s*/, "").replace(/^\d+\.\s*/, ""));
}

/**
 * Detecta documentos que já vêm em pares Pergunta/Resposta.
 * Não deduplica, não funde e não altera o conteúdo: 1 par reconhecido = 1 card.
 */
export function detectReadyFlashcards(document: ExtractedDocument, deckId: string): ReadyFlashcardDetection {
  const cards: Flashcard[] = [];
  let currentSection = "Flashcards importados";
  let pendingQuestion: { text: string; page: number; topic: string } | null = null;

  for (const page of document.pages) {
    const lines = page.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      if (/^(?:--)?#{1,6}\s+/.test(line)) {
        const heading = headingFromLine(line);
        if (heading) currentSection = heading;
        i += 1;
        continue;
      }

      const qMatch = line.match(/^(?:\*\*)?(?:P|Pergunta|Frente)\s*:(?:\*\*)?\s*(.*)$/i);
      if (qMatch) {
        const parts = [qMatch[1]];
        i += 1;
        while (i < lines.length && !/^(?:\*\*)?(?:R|Resposta|Verso)\s*:(?:\*\*)?/i.test(lines[i]) && !/^(?:\*\*)?(?:P|Pergunta|Frente)\s*:(?:\*\*)?/i.test(lines[i]) && !/^(?:--)?#{1,6}\s+/.test(lines[i])) {
          parts.push(lines[i]);
          i += 1;
        }
        pendingQuestion = { text: clean(parts.join(" ")), page: page.pageNumber, topic: currentSection };
        continue;
      }

      const rMatch = line.match(/^(?:\*\*)?(?:R|Resposta|Verso)\s*:(?:\*\*)?\s*(.*)$/i);
      if (rMatch && pendingQuestion) {
        const parts = [rMatch[1]];
        i += 1;
        while (i < lines.length && !/^(?:\*\*)?(?:P|Pergunta|Frente)\s*:(?:\*\*)?/i.test(lines[i]) && !/^(?:--)?#{1,6}\s+/.test(lines[i])) {
          parts.push(lines[i]);
          i += 1;
        }
        const answer = clean(parts.join(" "));
        if (pendingQuestion.text && answer) {
          const now = new Date().toISOString();
          cards.push({
            id: tempId("imported"),
            deckId,
            type: "basic",
            difficulty: "medium",
            topic: pendingQuestion.topic,
            question: pendingQuestion.text,
            answer,
            explanation: undefined,
            tags: [pendingQuestion.topic].filter(Boolean).slice(0, 3),
            learningObjective: `imported:${pendingQuestion.text.slice(0, 140)}`,
            sources: [{
              id: tempId("source-imported"),
              kind: "upload",
              title: document.name,
              documentId: document.documentId,
              page: pendingQuestion.page,
              excerpt: `${pendingQuestion.text} — ${answer}`.slice(0, 420),
              verificationStatus: "user_material",
              supports: "Pergunta e resposta importadas diretamente do documento.",
            }],
            createdAt: now,
            updatedAt: now,
          });
        }
        pendingQuestion = null;
        continue;
      }

      i += 1;
    }
  }

  const pairCount = cards.length;
  const confidence = pairCount >= 5 ? "high" : pairCount >= 2 ? "medium" : "low";
  return { detected: pairCount >= 2, cards, pairCount, confidence };
}
