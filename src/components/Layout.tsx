import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  BookOpen,
  Clock,
  Sun,
  Moon,
  X,
  Heart,
  ScrollText,
  CircleDot,
  LogIn,
  LogOut,
  Home,
  Users,
  Star,
  Settings,
  Compass,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const navItems = [
  { to: "/", label: "الرئيسية", icon: Home },
  { to: "/quran", label: "المصحف الكامل", icon: BookOpen },
  { to: "/prayer", label: "مواقيت الصلاة", icon: Clock },
  { to: "/azkar", label: "الأذكار", icon: Heart },
  { to: "/duas", label: "الأدعية", icon: Star },
  { to: "/quran-index", label: "فهرس المصحف", icon: Star },
  { to: "/qibla", label: "اتجاه القبلة", icon: Compass },
  { to: "/tasbih", label: "السبحة", icon: CircleDot },
  { to: "/hadith", label: "مكتبة الأحاديث", icon: ScrollText },
  { to: "/community", label: "مجتمع أمّتي", icon: Users },
  { to: "/saved", label: "المفضلة", icon: Star },
  { to: "/settings", label: "الإعدادات", icon: Settings },
];


export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("تم تسجيل الخروج");
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl hero-gradient text-gold">
              <BookOpen className="h-4 w-4" />
            </span>
            <span className="font-display text-2xl font-bold gold-gradient-text">أمتي</span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {navItems.slice(1).map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              aria-label="تبديل الإضاءة"
              className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-border bg-card transition-all duration-500 hover:border-gold hover:text-gold active:scale-90"
            >
              <Sun
                className={`absolute h-5 w-5 transition-all duration-500 ${
                  theme === "dark"
                    ? "translate-y-8 rotate-90 opacity-0"
                    : "translate-y-0 rotate-0 opacity-100"
                }`}
              />
              <Moon
                className={`absolute h-5 w-5 transition-all duration-500 ${
                  theme === "dark"
                    ? "translate-y-0 rotate-0 opacity-100"
                    : "-translate-y-8 -rotate-90 opacity-0"
                }`}
              />
            </button>

            <button
              onClick={() => setOpen((v) => !v)}
              aria-label="القائمة"
              className="flex h-10 w-10 flex-col items-center justify-center gap-[5px] rounded-xl border border-border bg-card transition-all hover:border-gold active:scale-90"
            >
              <span
                className={`block h-[2px] w-5 bg-current transition-all duration-300 ${
                  open ? "translate-y-[7px] rotate-45" : ""
                }`}
              />
              <span
                className={`block h-[2px] w-5 bg-current transition-all duration-300 ${
                  open ? "scale-x-0 opacity-0" : ""
                }`}
              />
              <span
                className={`block h-[2px] w-5 bg-current transition-all duration-300 ${
                  open ? "-translate-y-[7px] -rotate-45" : ""
                }`}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Drawer */}
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-[85%] max-w-sm flex-col border-l border-border bg-card pattern-bg transition-transform duration-500 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <span className="font-display text-2xl font-bold gold-gradient-text">أمتي</span>
          <button
            onClick={() => setOpen(false)}
            aria-label="إغلاق"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          {navItems.map((item, i) => (
            <Link
              key={item.to}
              to={item.to}
              className={`mb-1 flex items-center gap-3 rounded-xl px-4 py-3 text-base transition-all hover:bg-secondary ${
                open ? "animate-menu-item" : "opacity-0"
              }`}
              style={{ animationDelay: `${80 + i * 55}ms` }}
              activeProps={{ className: "bg-secondary text-gold" }}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-border p-4">
          {user ? (
            <button
              onClick={signOut}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted"
            >
              <LogOut className="h-4 w-4" /> تسجيل الخروج
            </button>
          ) : (
            <Link
              to="/auth"
              className="flex w-full items-center justify-center gap-2 rounded-xl hero-gradient px-4 py-3 text-sm font-semibold text-gold glow"
            >
              <LogIn className="h-4 w-4" /> تسجيل الدخول / حساب جديد
            </Link>
          )}
          <p className="mt-3 text-center text-xs text-muted-foreground">
            التسجيل اختياري — كل الأقسام متاحة للجميع
          </p>
        </div>
      </aside>

      <main>{children}</main>

      <footer className="mt-10 border-t border-border py-10 text-center">
        <p className="font-display text-xl gold-gradient-text">أمتي</p>
        <p className="mt-2 text-sm text-muted-foreground">
          ﴿ أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ ﴾
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          صدقة جارية عن الحاج مصطفى علي والحاج علي علي — رحمهما الله
        </p>
      </footer>
    </div>
  );
}

