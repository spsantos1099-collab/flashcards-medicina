import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import MobileNavigation from "./MobileNavigation";

// TODO (Fase 2): envolver com verificação de sessão do Firebase Auth e
// redirecionar para /login quando não houver usuário autenticado.
export default function AppShell() {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 px-5 md:px-8 py-6 pb-24 md:pb-6">
          <Outlet />
        </main>
      </div>
      <MobileNavigation />
    </div>
  );
}
