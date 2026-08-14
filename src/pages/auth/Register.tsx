import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { friendlyAuthError } from "../../lib/authErrors";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("As senhas não são iguais.");
      return;
    }

    setSubmitting(true);
    try {
      await register(name, email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h1 className="font-display text-2xl text-ink-900 dark:text-paper">Criar conta</h1>

      {error && (
        <div className="text-sm text-signal-600 bg-signal-400/10 border border-signal-600/30 rounded-lg px-3.5 py-2.5">
          {error}
        </div>
      )}

      <Field label="Nome" type="text" value={name} onChange={setName} />
      <Field label="Email" type="email" value={email} onChange={setEmail} />
      <Field label="Senha" type="password" value={password} onChange={setPassword} />
      <Field label="Confirmar senha" type="password" value={confirmPassword} onChange={setConfirmPassword} />

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper py-2.5 text-sm font-medium hover:bg-ink-800 dark:hover:bg-clinical-500 transition-colors disabled:opacity-60"
      >
        {submitting ? "Criando conta…" : "Criar conta"}
      </button>

      <p className="text-sm text-ink-400 text-center mt-2">
        Já tem conta?{" "}
        <Link to="/login" className="text-clinical-600 dark:text-clinical-300 font-medium">
          Entrar
        </Link>
      </p>
    </form>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-ink-600 dark:text-ink-200">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={type === "password" ? 6 : undefined}
        className="rounded-lg border border-ink-200 dark:border-ink-800 bg-transparent px-3.5 py-2.5 text-ink-900 dark:text-paper focus:border-clinical-500"
      />
    </label>
  );
}
