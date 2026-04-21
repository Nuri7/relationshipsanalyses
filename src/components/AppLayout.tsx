import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Users, MessageSquareHeart } from "lucide-react";

interface AppLayoutProps {
  children: React.ReactNode;
  /** Title shown in the header (defaults to "Relationship Analyzer") */
  title?: string;
  /** Subtitle shown below the title */
  subtitle?: string;
  /** Show the full navigation header with logout, matrix, feedback links */
  showNav?: boolean;
  /** Custom right-side header content */
  headerRight?: React.ReactNode;
  /** Custom left-side header content (replaces default logo+title) */
  headerLeft?: React.ReactNode;
}

const AppLayout = ({
  children,
  title = "Relationship Analyzer",
  subtitle,
  showNav = false,
  headerRight,
  headerLeft,
}: AppLayoutProps) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:py-4">
          {headerLeft || (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary overflow-hidden sm:h-10 sm:w-10">
                <img
                  src={`${import.meta.env.BASE_URL}favicon.png`}
                  alt="Logo"
                  className="h-7 w-7 object-contain sm:h-8 sm:w-8"
                />
              </div>
              <div>
                <h1 className="text-base font-bold sm:text-lg">{title}</h1>
                {subtitle && (
                  <p className="text-xs text-muted-foreground">{subtitle}</p>
                )}
              </div>
            </div>
          )}

          {headerRight || (showNav && (
            <div className="flex items-center gap-1 sm:gap-2">
              <Link to="/matrix">
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Users className="mr-1 h-4 w-4" /> Matrix
                </Button>
                <Button variant="ghost" size="icon" className="sm:hidden">
                  <Users className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/feedback" className="hidden sm:block">
                <Button variant="ghost" size="sm">Feedback</Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
};

export default AppLayout;
