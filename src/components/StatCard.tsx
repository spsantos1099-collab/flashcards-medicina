interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
}

export default function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-card border border-ink-200/70 dark:border-ink-800 bg-white dark:bg-ink-900 px-5 py-4 shadow-card">
      <div className="source-tab">{label}</div>
      <div className="font-display text-3xl mt-1 text-ink-900 dark:text-paper">{value}</div>
      {hint && <div className="text-xs text-ink-400 mt-1">{hint}</div>}
    </div>
  );
}
