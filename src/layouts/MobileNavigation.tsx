import { NavLink } from "react-router-dom";

const ITEMS = [
  { to: "/dashboard", label: "Início" },
  { to: "/library", label: "Biblioteca" },
  { to: "/create/upload", label: "Criar" },
  { to: "/study", label: "Revisar" },
  { to: "/profile", label: "Perfil" },
];

export default function MobileNavigation() {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-paper/95 dark:bg-ink-950/95 backdrop-blur border-t border-ink-200/60 dark:border-ink-800 pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegação principal"
    >
      <div className="grid grid-cols-5">
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] ${
                isActive ? "text-clinical-600 dark:text-clinical-300 font-medium" : "text-ink-400"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
