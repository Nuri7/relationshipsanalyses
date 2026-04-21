import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import ErrorBoundary from "@/components/ErrorBoundary";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import Analysis from "./pages/Analysis";
import Feedback from "./pages/Feedback";
import CommunicationMatrix from "./pages/CommunicationMatrix";
import MyRelationships from "./pages/MyRelationships";
import Features from "./pages/Features";
import SharedDashboard from "./pages/SharedDashboard";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children, session }: { children: React.ReactNode; session: Session | null }) {
  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <Routes>
              <Route path="/auth" element={session ? (() => { const r = sessionStorage.getItem("redirect_after_auth"); sessionStorage.removeItem("redirect_after_auth"); return <Navigate to={r || "/"} replace />; })() : <Auth />} />
              <Route path="/" element={<ProtectedRoute session={session}><Dashboard /></ProtectedRoute>} />
              <Route path="/upload" element={<ProtectedRoute session={session}><Upload /></ProtectedRoute>} />
              <Route path="/analysis/:uploadId" element={<ProtectedRoute session={session}><Analysis /></ProtectedRoute>} />
              <Route path="/feedback" element={<ProtectedRoute session={session}><Feedback /></ProtectedRoute>} />
              <Route path="/matrix" element={<ProtectedRoute session={session}><CommunicationMatrix /></ProtectedRoute>} />
              <Route path="/my-relationships" element={<ProtectedRoute session={session}><MyRelationships /></ProtectedRoute>} />
              <Route path="/shared/:token" element={<SharedDashboard />} />
              <Route path="/features" element={<Features />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
