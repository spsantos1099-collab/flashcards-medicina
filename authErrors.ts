// O Firebase retorna erros como "Firebase: Error (auth/invalid-credential)."
// Essa função traduz os códigos mais comuns para mensagens que fazem sentido
// para quem está usando o site (item 41 do briefing original).
export function friendlyAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? "";

  const messages: Record<string, string> = {
    "auth/invalid-credential": "Email ou senha incorretos.",
    "auth/invalid-email": "Esse email não parece válido.",
    "auth/user-not-found": "Não encontramos uma conta com esse email.",
    "auth/wrong-password": "Email ou senha incorretos.",
    "auth/email-already-in-use": "Já existe uma conta com esse email.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/too-many-requests": "Muitas tentativas seguidas. Espere um pouco e tente de novo.",
    "auth/network-request-failed": "Falha de conexão. Verifique sua internet e tente de novo.",
  };

  return messages[code] ?? "Algo deu errado. Tente novamente em instantes.";
}
