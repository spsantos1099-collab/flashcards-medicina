interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-16 px-6 rounded-card border border-dashed border-ink-200 dark:border-ink-800">
      <h3 className="font-display text-xl text-ink-900 dark:text-paper">{title}</h3>
      {description && <p className="text-sm text-ink-400 max-w-sm">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
