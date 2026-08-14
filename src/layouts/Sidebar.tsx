import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Início" },
  { to: "/library", label: "Biblioteca" },
  { to: "/create/upload", label: "Criar com IA" },
  { to: "/study", label: "Revisar" },
  { to: "/difficult", label: "Cards difíceis" },
  { to: "/favorites", label: "Favoritos" },
  { to: "/statistics", label: "Desempenho" },
];

export default function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-ink-200/60 dark:md:border-ink-800 md:py-8 md:px-4">
      <span className="font-display text-xl px-3 mb-10 text-ink-900 dark:text-paper">
        Fichário<span className="text-clinical-500">.</span>
      </span>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-clinical-50 text-clinical-700 dark:bg-clinical-700/20 dark:text-clinical-100 font-medium"
                  : "text-ink-600 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-800/60"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <NavLink
        to="/profile"
        className="mt-auto px-3 py-2 rounded-lg text-sm text-ink-600 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-800/60"
      >
        Perfil
      </NavLink>
    </aside>
  );
}
