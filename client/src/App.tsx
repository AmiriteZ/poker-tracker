import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { AppLayout } from "@/components/layout";
import { AuthPage } from "@/pages/AuthPage";
import { GroupsPage } from "@/pages/GroupsPage";
import { GroupPage } from "@/pages/GroupPage";
import { SessionPage } from "@/pages/SessionPage";
import { PlayerPage } from "@/pages/PlayerPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { SoloPage } from "@/pages/SoloPage";
import { JoinPage } from "@/pages/JoinPage";

function RequireAuth() {
  const { firebaseUser, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        <img src="/chip.svg" alt="" className="mr-2 size-5 animate-spin" /> Loading…
      </div>
    );
  }
  if (!firebaseUser) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

export default function App() {
  const { isDark } = useTheme();
  return (
    <BrowserRouter>
      <Toaster richColors position="top-center" theme={isDark ? "dark" : "light"} />
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route index element={<GroupsPage />} />
            <Route path="groups/:groupId" element={<GroupPage />} />
            <Route path="groups/:groupId/sessions/:sessionId" element={<SessionPage />} />
            <Route path="groups/:groupId/players/:userId" element={<PlayerPage />} />
            <Route path="join/:code" element={<JoinPage />} />
            <Route path="solo" element={<SoloPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
