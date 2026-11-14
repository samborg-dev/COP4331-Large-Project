import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthPage, ProtectedPage } from "./pages/AuthPage";
import { GamePage, GameSessionProvider } from "./pages/GamePage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import "./App.css";
export default function App() {
  return (
    <BrowserRouter>
      <GameSessionProvider>
        <Routes>
          {[
            "/",
            "/login",
            "/register",
            "/check-inbox",
            "/verify-email",
            "/forgot-password",
            "/reset-password",
          ].map((path) => (
            <Route key={path} path={path} element={<AuthPage />} />
          ))}
          <Route path="/game" element={<ProtectedPage />} />
          <Route path="/guest" element={<GamePage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </GameSessionProvider>
    </BrowserRouter>
  );
}
