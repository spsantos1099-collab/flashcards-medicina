import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const COURSE_OPTIONS = [
  "Medicina",
  "Enfermagem",
  "Odontologia",
  "Fisioterapia",
  "Farmácia",
  "Biomedicina",
  "Nutrição",
  "Psicologia",
  "Fonoaudiologia",
  "Terapia Ocupacional",
] as const;

function profileErrorMessage(error: unknown) {
  const code = (error as { code?: string })?.code ?? "";
  const message = error instanceof Error ? error.message : "";

  if (code === "auth/invalid-credential" || code === "auth/wrong-password") return "A senha atual está incorreta.";
  if (code === "auth/weak-password") return "A nova senha precisa ter pelo menos 6 caracteres.";
  if (code === "auth/too-many-requests") return "Muitas tentativas seguidas. Aguarde um pouco e tente novamente.";
  if (code === "auth/network-request-failed") return "Não foi possível conectar. Verifique sua internet e tente novamente.";
  if (code === "auth/requires-recent-login") return "Por segurança, saia da conta, entre novamente e tente alterar a senha.";
  return message || "Não foi possível concluir a alteração. Tente novamente.";
}

export default function Profile() {
  const { user, profile, logout, updateAccountProfile, changePassword } = useAuth();
  const navigate = useNavigate();

  const initialCourse = profile?.course?.trim() || "Medicina";
  const knownCourse = useMemo(
    () => COURSE_OPTIONS.includes(initialCourse as (typeof COURSE_OPTIONS)[number]),
    [initialCourse],
  );

  const [name, setName] = useState(profile?.name || user?.displayName || "");
  const [courseChoice, setCourseChoice] = useState(knownCourse ? initialCourse : "Outro");
  const [customCourse, setCustomCourse] = useState(knownCourse ? "" : initialCourse);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    const nextName = profile?.name || user?.displayName || "";
    const nextCourse = profile?.course?.trim() || "Medicina";
    const nextKnown = COURSE_OPTIONS.includes(nextCourse as (typeof COURSE_OPTIONS)[number]);
    setName(nextName);
    setCourseChoice(nextKnown ? nextCourse : "Outro");
    setCustomCourse(nextKnown ? "" : nextCourse);
  }, [profile?.name, profile?.course, user?.displayName]);

  const selectedCourse = courseChoice === "Outro" ? customCourse.trim() : courseChoice;

  const handleProfileSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setProfileMessage(null);
    setProfileError(null);

    if (!name.trim()) {
      setProfileError("Informe seu nome.");
      return;
    }
    if (!selectedCourse) {
      setProfileError("Informe seu curso.");
      return;
    }

    setProfileSaving(true);
    try {
      await updateAccountProfile(name, selectedCourse);
      setProfileMessage("Perfil atualizado.");
    } catch (error) {
      setProfileError(profileErrorMessage(error));
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);

    if (newPassword.length < 6) {
      setPasswordError("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("A confirmação não corresponde à nova senha.");
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError("Escolha uma senha diferente da atual.");
      return;
    }

    setPasswordSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Senha alterada com sucesso.");
    } catch (error) {
      setPasswordError(profileErrorMessage(error));
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-7">
        <h1 className="font-display text-3xl text-ink-900 dark:text-paper">Perfil</h1>
        <p className="text-ink-400 mt-1">Atualize seus dados e a segurança da sua conta.</p>
      </div>

      <form onSubmit={handleProfileSubmit} className="rounded-card border border-ink-200/70 dark:border-ink-800 bg-white dark:bg-ink-900 p-5 sm:p-6 shadow-card mb-5">
        <div className="mb-5">
          <h2 className="font-display text-xl text-ink-900 dark:text-paper">Dados pessoais</h2>
          <p className="text-sm text-ink-400 mt-1">Essas informações ajudam a personalizar sua experiência no Fichário.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              className="field"
              placeholder="Seu nome"
            />
          </Field>

          <Field label="Curso">
            <select
              value={courseChoice}
              onChange={(event) => setCourseChoice(event.target.value)}
              className="field"
            >
              {COURSE_OPTIONS.map((course) => <option key={course} value={course}>{course}</option>)}
              <option value="Outro">Outro</option>
            </select>
          </Field>
        </div>

        {courseChoice === "Outro" && (
          <div className="mt-4">
            <Field label="Qual curso?">
              <input
                value={customCourse}
                onChange={(event) => setCustomCourse(event.target.value)}
                className="field"
                placeholder="Digite o nome do curso"
              />
            </Field>
          </div>
        )}

        <div className="mt-4">
          <Field label="Email">
            <input
              value={profile?.email || user?.email || ""}
              readOnly
              className="field bg-ink-50/80 dark:bg-ink-950/40 text-ink-500 cursor-not-allowed"
            />
          </Field>
          <p className="text-xs text-ink-400 mt-1.5">O email é usado para entrar na conta.</p>
        </div>

        {profileError && <Message tone="error">{profileError}</Message>}
        {profileMessage && <Message tone="success">{profileMessage}</Message>}

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={profileSaving}
            className="rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper px-4 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {profileSaving ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </form>

      <form onSubmit={handlePasswordSubmit} className="rounded-card border border-ink-200/70 dark:border-ink-800 bg-white dark:bg-ink-900 p-5 sm:p-6 shadow-card mb-5">
        <div className="mb-5">
          <h2 className="font-display text-xl text-ink-900 dark:text-paper">Senha</h2>
          <p className="text-sm text-ink-400 mt-1">Para trocar a senha, confirme primeiro a senha atual.</p>
        </div>

        <div className="grid gap-4">
          <Field label="Senha atual">
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              className="field"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nova senha">
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={6}
                className="field"
              />
            </Field>
            <Field label="Confirmar nova senha">
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={6}
                className="field"
              />
            </Field>
          </div>
        </div>

        {passwordError && <Message tone="error">{passwordError}</Message>}
        {passwordMessage && <Message tone="success">{passwordMessage}</Message>}

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
            className="rounded-lg border border-ink-200 dark:border-ink-700 px-4 py-2.5 text-sm font-medium text-ink-700 dark:text-paper hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-40"
          >
            {passwordSaving ? "Alterando…" : "Alterar senha"}
          </button>
        </div>
      </form>

      <div className="rounded-card border border-ink-200/70 dark:border-ink-800 px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <div className="font-medium text-ink-900 dark:text-paper">Sair da conta</div>
          <p className="text-sm text-ink-400 mt-0.5">Você poderá entrar novamente com seu email e senha.</p>
        </div>
        <button onClick={handleLogout} className="text-sm text-signal-600 font-medium shrink-0">
          Sair
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="block text-ink-600 dark:text-ink-200 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function Message({ tone, children }: { tone: "success" | "error"; children: React.ReactNode }) {
  return (
    <div className={`mt-4 rounded-lg border px-3.5 py-2.5 text-sm ${
      tone === "success"
        ? "border-clinical-300/70 bg-clinical-50/60 text-clinical-700 dark:border-clinical-700 dark:bg-clinical-700/10 dark:text-clinical-200"
        : "border-signal-300/60 bg-signal-400/10 text-signal-700 dark:text-signal-300"
    }`}>
      {children}
    </div>
  );
}
