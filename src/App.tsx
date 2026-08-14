import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./layouts/AppShell";
import AuthLayout from "./layouts/AuthLayout";

import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";

import Dashboard from "./pages/Dashboard";
import Library from "./pages/Library";
import DeckDetail from "./pages/DeckDetail";

import CreateUpload from "./pages/create/CreateUpload";
import CreateConfigure from "./pages/create/CreateConfigure";
import CreateReview from "./pages/create/CreateReview";

import Study from "./pages/Study";
import Difficult from "./pages/Difficult";
import Favorites from "./pages/Favorites";
import Statistics from "./pages/Statistics";
import Profile from "./pages/Profile";

export default function App() {
  return (
    <Routes>
      {/* Autenticação — sem sidebar/topbar */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>

      {/* Área logada — protegida de verdade a partir da Fase 2 (Firebase Auth) */}
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/library" element={<Library />} />
        <Route path="/decks/:deckId" element={<DeckDetail />} />

        <Route path="/create/upload" element={<CreateUpload />} />
        <Route path="/create/configure" element={<CreateConfigure />} />
        <Route path="/create/review" element={<CreateReview />} />
        <Route path="/create" element={<Navigate to="/create/upload" replace />} />

        <Route path="/study" element={<Study />} />
        <Route path="/study/:deckId" element={<Study />} />

        <Route path="/difficult" element={<Difficult />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/statistics" element={<Statistics />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
