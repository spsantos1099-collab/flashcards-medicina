import type { User } from "firebase/auth";
import type { ResearchSearchMeta, ResearchSource } from "../../types";

export interface ResearchSearchOptions {
  topic: string;
  sourceGroups: Array<"guidelines" | "reviews" | "primary">;
  recency: "5y" | "10y" | "all";
  maxResults: number;
  allowInternational: boolean;
}

interface SearchResponse {
  sources?: ResearchSource[];
  meta?: ResearchSearchMeta;
  error?: string;
  message?: string;
}

export class ResearchSearchError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "ResearchSearchError";
  }
}

export async function searchMedicalSources({
  user,
  options,
}: {
  user: User;
  options: ResearchSearchOptions;
}): Promise<{ sources: ResearchSource[]; meta: ResearchSearchMeta }> {
  const topic = options.topic.trim();
  if (topic.length < 3) {
    throw new ResearchSearchError("Digite um tema médico com pelo menos 3 caracteres.", "topic_too_short");
  }
  if (!options.sourceGroups.length) {
    throw new ResearchSearchError("Selecione pelo menos um tipo de fonte.", "no_source_group");
  }

  const idToken = await user.getIdToken();
  let response: Response;
  try {
    response = await fetch("/.netlify/functions/search-medical-sources", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        topic,
        sourceGroups: options.sourceGroups,
        recency: options.recency,
        maxResults: options.maxResults,
        allowInternational: options.allowInternational,
      }),
    });
  } catch {
    throw new ResearchSearchError(
      "Não foi possível alcançar o serviço de pesquisa. Confira sua conexão e tente novamente.",
      "network_error",
    );
  }

  let payload: SearchResponse;
  try {
    payload = await response.json();
  } catch {
    throw new ResearchSearchError("A pesquisa retornou uma resposta inválida.", "invalid_response");
  }

  if (!response.ok) {
    throw new ResearchSearchError(
      payload.message || "Não foi possível pesquisar fontes médicas agora.",
      payload.error || `http_${response.status}`,
    );
  }

  if (!Array.isArray(payload.sources) || !payload.meta) {
    throw new ResearchSearchError("A pesquisa não retornou fontes válidas.", "missing_payload");
  }

  return { sources: payload.sources, meta: payload.meta };
}
