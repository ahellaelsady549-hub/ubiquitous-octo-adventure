import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — أمتي" },
      { name: "description", content: "أنشئ حسابًا اختياريًا في أمتي لحفظ وردك وأذكارك على كل أجهزتك." },
      { property: "og:title", content: "تسجيل الدخول — أمتي" },
      { property: "og:description", content: "حساب اختياري لحفظ تقدّمك في القراءة والأذكار." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("تم إنشاء حسابك بنجاح");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("أهلًا بك من جديد");
      }
      void navigate({ to: "/" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "حدث خطأ";
      toast.error(
        msg.includes("Invalid login")
          ? "البريد أو كلمة المرور غير صحيحة"
          : msg.includes("already registered")
            ? "هذا البريد مسجّل بالفعل"
            : msg,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="surface pattern-bg p-8">
        <h1 className="text-center font-display text-3xl font-bold gold-gradient-text">
          {mode === "login" ? "تسجيل الدخول" : "إنشاء حساب جديد"}
        </h1>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          التسجيل اختياري تمامًا — كل أقسام الموقع متاحة بدون حساب.
          {user ? " أنت مسجّل الدخول بالفعل." : ""}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          {mode === "signup" && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="الاسم"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold"
            />
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="البريد الإلكتروني"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="كلمة المرور (٦ أحرف على الأقل)"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold"
          />
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl hero-gradient py-3 text-sm font-bold text-gold disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "login" ? (
              <LogIn className="h-4 w-4" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {mode === "login" ? "دخول" : "إنشاء الحساب"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-5 w-full text-center text-sm text-gold"
        >
          {mode === "login" ? "ليس لديك حساب؟ أنشئ حسابًا" : "لديك حساب بالفعل؟ سجّل الدخول"}
        </button>
      </div>
    </div>
  );
}
