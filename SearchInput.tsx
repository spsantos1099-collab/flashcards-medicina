interface SearchInputProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
}

export default function SearchInput({ placeholder, value, onChange, onSubmit }: SearchInputProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const input = form.elements.namedItem("search") as HTMLInputElement | null;
        onSubmit?.(input?.value ?? value ?? "");
      }}
    >
      <label className="relative block">
        <span className="sr-only">Buscar</span>
        <input
          name="search"
          type="search"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder ?? "Buscar…"}
          className="w-full rounded-lg border border-ink-200 dark:border-ink-800 bg-paper-dim/50 dark:bg-ink-900 px-3.5 py-2 text-sm text-ink-900 dark:text-paper placeholder:text-ink-400 focus:bg-white dark:focus:bg-ink-950 transition-colors"
        />
      </label>
    </form>
  );
}
