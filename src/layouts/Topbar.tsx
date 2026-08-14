import SearchInput from "../components/SearchInput";

export default function Topbar() {
  return (
    <header className="flex items-center justify-between gap-4 px-5 md:px-8 py-4 border-b border-ink-200/60 dark:border-ink-800">
      <div className="md:hidden font-display text-lg text-ink-900 dark:text-paper">
        Fichário<span className="text-clinical-500">.</span>
      </div>
      <div className="flex-1 max-w-md">
        <SearchInput placeholder="Buscar em todos os decks…" />
      </div>
    </header>
  );
}
