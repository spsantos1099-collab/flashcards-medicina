import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { friendlyAuthError } from "../../lib/authErrors";

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl text-ink-900 dark:text-paper">Verifique seu email</h1>
        <p className="text-sm text-ink-500">
          Se existir uma conta com o email <strong>{email}</strong>, enviamos um link para
          redefinir a senha.
        </p>
        <Link to="/login" className="text-sm text-clinical-600 dark:text-clinical-300">
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h1 className="font-display text-2xl text-ink-900 dark:text-paper">Recuperar senha</h1>
      <p className="text-sm text-ink-400 -mt-2">
        Informe seu email e enviaremos um link para redefinir sua senha.
      </p>

      {error && (
        <div className="text-sm text-signal-600 bg-signal-400/10 border border-signal-600/30 rounded-lg px-3.5 py-2.5">
          {error}
        </div>
      )}

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-ink-600 dark:text-ink-200">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-lg border border-ink-200 dark:border-ink-800 bg-transparent px-3.5 py-2.5 text-ink-900 dark:text-paper focus:border-clinical-500"
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper py-2.5 text-sm font-medium hover:bg-ink-800 dark:hover:bg-clinical-500 transition-colors disabled:opacity-60"
      >
        {submitting ? "Enviando…" : "Enviar link"}
      </button>

      <Link to="/login" className="text-sm text-clinical-600 dark:text-clinical-300 text-center mt-2">
        Voltar para o login
      </Link>
    </form>
  );
}
