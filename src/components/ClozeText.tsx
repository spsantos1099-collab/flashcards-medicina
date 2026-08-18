import { Fragment } from "react";

interface ClozeTextProps {
  text: string;
  revealed?: boolean;
}

// Renderiza a sintaxe de cloze usada internamente ({{c1::resposta}})
// sem expor os marcadores técnicos ao usuário. Antes da revelação,
// cada trecho vira uma lacuna; depois, o conteúdo aparece destacado.
export default function ClozeText({ text, revealed = false }: ClozeTextProps) {
  const pattern = /\{\{c\d+::([^}]+)\}\}/g;
  const parts: Array<{ kind: "text" | "cloze"; value: string; hint?: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ kind: "text", value: text.slice(lastIndex, match.index) });
    }

    const raw = match[1];
    const [answer, ...hintParts] = raw.split("::");
    const hint = hintParts.length > 0 ? hintParts.join("::") : undefined;
    parts.push({ kind: "cloze", value: answer.trim(), hint: hint?.trim() });
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ kind: "text", value: text.slice(lastIndex) });
  }

  if (parts.length === 0) return <>{text}</>;

  return (
    <>
      {parts.map((part, index) => {
        if (part.kind === "text") {
          return <Fragment key={index}>{part.value}</Fragment>;
        }

        return (
          <span
            key={index}
            className={
              revealed
                ? "rounded bg-clinical-50 dark:bg-clinical-900/30 px-1 text-clinical-700 dark:text-clinical-200 font-semibold"
                : "inline-block min-w-[3.5rem] rounded border-b-2 border-clinical-500/70 px-1.5 text-center text-clinical-700 dark:text-clinical-200 font-medium"
            }
          >
            {revealed ? part.value : part.hint ? `[${part.hint}]` : "•••••"}
          </span>
        );
      })}
    </>
  );
}
