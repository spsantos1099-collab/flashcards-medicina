import { Link } from "react-router-dom";

// TODO (Fase 2): ligar ao Firebase Authentication (sendPasswordResetEmail)
export default function ForgotPassword() {
  return (
    <form className="flex flex-col gap-4">
      <h1 className="font-display text-2xl text-ink-900 dark:text-paper">Recuperar senha</h1>
      <p className="text-sm text-ink-400 -mt-2">
        Informe seu email e enviaremos um link para redefinir sua senha.
      </p>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-ink-600 dark:text-ink-200">Email</span>
        <input
          type="email"
          required
          className="rounded-lg border border-ink-200 dark:border-ink-800 bg-transparent px-3.5 py-2.5 text-ink-900 dark:text-paper focus:border-clinical-500"
        />
      </label>

      <button
        type="submit"
        className="mt-2 rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper py-2.5 text-sm font-medium hover:bg-ink-800 dark:hover:bg-clinical-500 transition-colors"
      >
        Enviar link
      </button>

      <Link to="/login" className="text-sm text-clinical-600 dark:text-clinical-300 text-center mt-2">
        Voltar para o login
      </Link>
    </form>
  );
}
