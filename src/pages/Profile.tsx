// TODO (Fase 2): puxar nome/email reais do Firebase Authentication e implementar logout.
export default function Profile() {
  return (
    <div className="max-w-md">
      <h1 className="font-display text-2xl text-ink-900 dark:text-paper mb-6">Perfil</h1>

      <div className="rounded-card border border-ink-200/70 dark:border-ink-800 bg-white dark:bg-ink-900 p-5 shadow-card flex flex-col gap-3">
        <Row label="Nome" value="Ana" />
        <Row label="Email" value="—" />
        <Row label="Curso" value="Medicina" />
      </div>

      <button className="mt-6 text-sm text-signal-600 font-medium">Sair</button>
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
