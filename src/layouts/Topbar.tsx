import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import SearchInput from "../components/SearchInput";

export default function Topbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [value, setValue] = useState(location.pathname === "/search" ? searchParams.get("q") || "" : "");

  useEffect(() => {
    setValue(location.pathname === "/search" ? searchParams.get("q") || "" : "");
  }, [location.pathname, searchParams]);

  const submit = (raw: string) => {
    const query = raw.trim();
    if (!query) {
      if (location.pathname === "/search") navigate("/dashboard");
      return;
    }
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <header className="flex items-center justify-between gap-4 px-5 md:px-8 py-4 border-b border-ink-200/60 dark:border-ink-800">
      <div className="md:hidden font-display text-lg text-ink-900 dark:text-paper">
        Fichário<span className="text-clinical-500">.</span>
      </div>
      <div className="flex-1 max-w-md">
        <SearchInput
          placeholder="Buscar em todos os decks…"
          value={value}
          onChange={setValue}
          onSubmit={submit}
        />
      </div>
    </header>
  );
}
