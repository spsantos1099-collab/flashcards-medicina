import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Profile() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="max-w-md">
      <h1 className="font-display text-2xl text-ink-900 dark:text-paper mb-6">Perfil</h1>

      <div className="rounded-card border border-ink-200/70 dark:border-ink-800 bg-white dark:bg-ink-900 p-5 shadow-card flex flex-col gap-3">
        <Row label="Nome" value={profile?.name || user?.displayName || "—"} />
        <Row label="Email" value={profile?.email || user?.email || "—"} />
        <Row label="Curso" value={profile?.course || "Medicina"} />
      </div>

      <button onClick={handleLogout} className="mt-6 text-sm text-signal-600 font-medium">
        Sair
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-400">{label}</span>
      <span className="text-ink-900 dark:text-paper font-medium">{value}</span>
    </div>
  );
}
