import { Link } from "react-router-dom";

// TODO (Fase 2): ligar ao Firebase Authentication (createUserWithEmailAndPassword)
export default function Register() {
  return (
    <form className="flex flex-col gap-4">
      <h1 className="font-display text-2xl text-ink-900 dark:text-paper">Criar conta</h1>

      <Field label="Nome" type="text" name="name" />
      <Field label="Email" type="email" name="email" />
      <Field label="Senha" type="password" name="password" />
      <Field label="Confirmar senha" type="password" name="confirmPassword" />

      <button
        type="submit"
        className="mt-2 rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper py-2.5 text-sm font-medium hover:bg-ink-800 dark:hover:bg-clinical-500 transition-colors"
      >
        Criar conta
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

function Field({ label, type, name }: { label: string; type: string; name: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-ink-600 dark:text-ink-200">{label}</span>
      <input
        type={type}
        name={name}
        required
        className="rounded-lg border border-ink-200 dark:border-ink-800 bg-transparent px-3.5 py-2.5 text-ink-900 dark:text-paper focus:border-clinical-500"
      />
    </label>
  );
}
