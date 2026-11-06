import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { tasbihPhrases } from "@/data/azkar";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/tasbih")({
  head: () => ({
    meta: [
      { title: "السبحة الإلكترونية — أمتي" },
      { name: "description", content: "سبحة إلكترونية أنيقة مع عدّاد للتسبيح والحمد والتكبير والاستغفار وأذكار مخصّصة." },
      { property: "og:title", content: "السبحة الإلكترونية — أمتي" },
      { property: "og:description", content: "سبّح واحسب أذكارك بسهولة مع حفظ العدّاد وإضافة ذكر خاص بك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://spiritual-compass-36.lovable.app/tasbih" }],
  }),
  component: TasbihPage,
});

const KEY = "emty-tasbih";

type Phrase = { text: string; target: number; id?: string };

function TasbihPage() {
  const { user } = useAuth();
  const [index, setIndex] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [pulse, setPulse] = useState(false);
  const [custom, setCustom] = useState<{ id: string; text: string; target: number }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ text: "", target: 33 });

  const phrases: Phrase[] = useMemo(
    () => [...tasbihPhrases.map((p) => ({ text: p.text, target: p.target })), ...custom],
    [custom],
  );
  const phrase = phrases[Math.min(index, phrases.length - 1)]!;
  const count = counts[phrase.text] ?? 0;
  const progress = Math.min(100, Math.round((count / phrase.target) * 100));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  useEffect(() => {
    try {
      setCounts(JSON.parse(localStorage.getItem(KEY) ?? "{}"));
    } catch {
      /* ignore */
    }
  }, []);

  // مزامنة العدّاد مع الحساب ليستمر بين الأجهزة
  useEffect(() => {
    if (!user) return;
    void supabase
      .from("tasbih_counts")
      .select("phrase, count")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!data?.length) return;
        setCounts((local) => {
          const merged = { ...local };
          for (const row of data) {
            merged[row.phrase] = Math.max(merged[row.phrase] ?? 0, row.count);
          }
          localStorage.setItem(KEY, JSON.stringify(merged));
          // ارفع أي عدّ محلي أعلى من المحفوظ
          const ups = Object.entries(merged)
            .filter(([ph, v]) => (data.find((d) => d.phrase === ph)?.count ?? -1) < v)
            .map(([phrase, count]) => ({
              user_id: user.id,
              phrase,
              count,
              updated_at: new Date().toISOString(),
            }));
          if (ups.length) void supabase.from("tasbih_counts").upsert(ups);
          return merged;
        });
      });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("custom_azkar")
      .select("id, text, target")
      .order("created_at", { ascending: true })
      .then(({ data }) => setCustom(data ?? []));
  }, [user]);

  const save = (next: Record<string, number>) => {
    setCounts(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  };

  const tap = () => {
    const value = count + 1;
    save({ ...counts, [phrase.text]: value });
    setPulse(true);
    setTimeout(() => setPulse(false), 200);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(value % phrase.target === 0 ? [40, 40, 80] : 16);
    }
    if (user) {
      void supabase
        .from("tasbih_counts")
        .upsert({ user_id: user.id, phrase: phrase.text, count: value, updated_at: new Date().toISOString() });
    }
  };

  const addCustom = async () => {
    if (form.text.trim().length < 2) {
      toast.error("اكتب نص الذكر أولًا");
      return;
    }
    if (!user) {
      toast.error("سجّل الدخول لحفظ أذكارك المخصّصة");
      return;
    }
    const { data, error } = await supabase
      .from("custom_azkar")
      .insert({ user_id: user.id, text: form.text.trim(), target: form.target })
      .select("id, text, target")
      .single();
    if (error || !data) {
      toast.error("تعذّر الحفظ");
      return;
    }
    setCustom((c) => [...c, data]);
    setForm({ text: "", target: 33 });
    setShowForm(false);
    setIndex(phrases.length);
    toast.success("تمت إضافة الذكر، وستجده أيضًا في صفحة الأذكار");
  };

  const removeCustom = async (id: string) => {
    await supabase.from("custom_azkar").delete().eq("id", id);
    setCustom((c) => c.filter((x) => x.id !== id));
    setIndex(0);
  };

  const beads = Array.from({ length: 33 });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-bold gold-gradient-text">السبحة</h1>
      <p className="mt-2 text-sm text-muted-foreground">اضغط الحبّة الكبرى للعدّ، وأضف ذكرك الخاص بهدف يناسبك.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {phrases.map((p, i) => (
          <button
            key={p.id ?? p.text}
            onClick={() => setIndex(i)}
            className={`rounded-full border px-3.5 py-1.5 text-xs transition-all ${
              i === index ? "border-gold bg-secondary text-gold glow" : "border-border bg-card hover:border-gold/50"
            }`}
          >
            {p.text.length > 26 ? `${p.text.slice(0, 26)}…` : p.text}
          </button>
        ))}
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full border border-gold/60 px-3.5 py-1.5 text-xs text-gold"
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} ذكر مخصّص
        </button>
      </div>

      {showForm && (
        <div className="surface mt-4 animate-fade-up space-y-3 p-4">
          <input
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            placeholder="اكتب الذكر..."
            className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm"
          />
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">الهدف</span>
            <input
              type="number"
              min={1}
              value={form.target}
              onChange={(e) => setForm({ ...form, target: Math.max(1, Number(e.target.value)) })}
              className="w-24 rounded-xl border border-border bg-card px-3 py-2 text-sm"
            />
            <button
              onClick={addCustom}
              className="inline-flex items-center gap-1 rounded-xl hero-gradient px-4 py-2 text-sm font-semibold text-gold"
            >
              <Check className="h-4 w-4" /> إضافة
            </button>
          </div>
        </div>
      )}

      <div className="surface mt-6 overflow-hidden p-8 text-center pattern-bg">
        <p className="font-display text-2xl leading-relaxed text-gold sm:text-3xl">{phrase.text}</p>

        {/* حلقة الحبّات */}
        <div className="relative mx-auto mt-8 h-64 w-64">
          {beads.map((_, i) => {
            const angle = (i / beads.length) * Math.PI * 2 - Math.PI / 2;
            const active = i < Math.min(beads.length, Math.round((progress / 100) * beads.length));
            return (
              <span
                key={i}
                className={`absolute h-2.5 w-2.5 rounded-full transition-all duration-300 ${
                  active ? "bg-gold shadow-[0_0_10px_var(--gold)]" : "bg-muted-foreground/25"
                }`}
                style={{
                  left: `calc(50% + ${Math.cos(angle) * 118}px - 5px)`,
                  top: `calc(50% + ${Math.sin(angle) * 118}px - 5px)`,
                }}
              />
            );
          })}

          <button
            onClick={tap}
            aria-label="عدّ"
            className={`absolute left-1/2 top-1/2 flex h-44 w-44 -translate-x-1/2 -translate-y-1/2 select-none flex-col items-center justify-center rounded-full hero-gradient text-gold transition-transform duration-150 animate-pulse-ring ${
              pulse ? "scale-95" : "scale-100"
            }`}
          >
            <span className="text-5xl font-bold tabular-nums">{count}</span>
            <span className="mt-1 text-xs text-gold-soft">/ {phrase.target}</span>
          </button>
        </div>

        <div className="mx-auto mt-8 h-2 max-w-xs overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${progress}%`, backgroundImage: "var(--gradient-gold)" }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">إجمالي تسبيحاتك {total}</p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => save({ ...counts, [phrase.text]: 0 })}
            className="inline-flex items-center gap-1 rounded-xl bg-secondary px-4 py-2 text-sm"
          >
            <RotateCcw className="h-4 w-4" /> تصفير هذا الذكر
          </button>
          <button
            onClick={() => save({})}
            className="inline-flex items-center gap-1 rounded-xl border border-border px-4 py-2 text-sm"
          >
            <Trash2 className="h-4 w-4" /> تصفير الكل
          </button>
          {phrase.id && (
            <button
              onClick={() => removeCustom(phrase.id!)}
              className="inline-flex items-center gap-1 rounded-xl border border-destructive/50 px-4 py-2 text-sm text-destructive"
            >
              <Trash2 className="h-4 w-4" /> حذف الذكر المخصّص
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
