import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, Plus, RotateCcw, SkipForward, Sparkles, Star, Trash2 } from "lucide-react";
import { azkarCategories as baseCategories, type Zikr } from "@/data/azkar";
import { extraCategories } from "@/data/azkar-extra";

const azkarCategories = [...baseCategories.filter((c) => c.id !== "hisn"), ...extraCategories];

import { useSaved } from "@/lib/saved";
import { writeLast } from "@/lib/saved";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/azkar")({
  validateSearch: (s: Record<string, unknown>): { cat?: string } =>
    typeof s["cat"] === "string" ? { cat: s["cat"] } : {},
  head: () => ({
    meta: [
      { title: "الأذكار بالترتيب — أمتي" },
      {
        name: "description",
        content:
          "أذكار الصباح والمساء والنوم والاستيقاظ وبعد الطعام بترتيب متتابع مع العدّاد والفائدة والدليل وإمكانية إضافة ذكر مخصّص.",
      },
      { property: "og:title", content: "الأذكار بالترتيب — أمتي" },
      { property: "og:description", content: "اذكر بالترتيب: عدّاد، تخطٍّ، فائدة كل ذكر ودليله." },
    ],
  }),
  component: AzkarPage,
});

const key = (cat: string) => `emty-azkar-${cat}-${new Date().toDateString()}`;

type CustomZikr = { id: string; text: string; target: number; benefit: string | null };

function AzkarPage() {
  const { user } = useAuth();
  const { isSaved, toggle } = useSaved();
  const { cat } = Route.useSearch();
  const [active, setActive] = useState(
    cat && azkarCategories.some((c) => c.id === cat) ? cat : azkarCategories[0]!.id,
  );
  useEffect(() => {
    if (cat && azkarCategories.some((c) => c.id === cat)) setActive(cat);
  }, [cat]);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [index, setIndex] = useState(0);
  const [pulse, setPulse] = useState(false);
  const [custom, setCustom] = useState<CustomZikr[]>([]);
  const [form, setForm] = useState({ text: "", target: 33, benefit: "" });
  const [showForm, setShowForm] = useState(false);

  const isCustom = active === "custom";

  const items: Zikr[] = useMemo(
    () =>
      isCustom
        ? custom.map((c) => (c.benefit ? { text: c.text, count: c.target, benefit: c.benefit } : { text: c.text, count: c.target }))
        : (azkarCategories.find((c) => c.id === active)?.items ?? []),
    [active, custom, isCustom],
  );

  useEffect(() => {
    try {
      setCounts(JSON.parse(localStorage.getItem(key(active)) ?? "{}"));
    } catch {
      setCounts({});
    }
    setIndex(0);
  }, [active]);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("custom_azkar")
      .select("id, text, target, benefit")
      .order("created_at", { ascending: true })
      .then(({ data }) => setCustom(data ?? []));
  }, [user]);

  const current = items[index];

  useEffect(() => {
    if (!current) return;
    writeLast({ azkar: { category: active, index, label: current.text.slice(0, 60) } });
  }, [active, index, current]);

  const save = (next: Record<number, number>) => {
    setCounts(next);
    localStorage.setItem(key(active), JSON.stringify(next));
  };

  const tap = () => {
    if (!current) return;
    const c = (counts[index] ?? 0) + 1;
    save({ ...counts, [index]: c });
    setPulse(true);
    setTimeout(() => setPulse(false), 200);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(15);
    if (c >= current.count) {
      setTimeout(() => next(), 350);
    }
  };

  const next = () => {
    setIndex((i) => (i + 1 < items.length ? i + 1 : i));
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
      .insert({ user_id: user.id, text: form.text.trim(), target: form.target, benefit: form.benefit || null })
      .select("id, text, target, benefit")
      .single();
    if (error || !data) {
      toast.error("تعذّر الحفظ");
      return;
    }
    setCustom((c) => [...c, data]);
    setForm({ text: "", target: 33, benefit: "" });
    setShowForm(false);
    toast.success("تمت إضافة الذكر");
  };

  const removeCustom = async (id: string) => {
    await supabase.from("custom_azkar").delete().eq("id", id);
    setCustom((c) => c.filter((x) => x.id !== id));
  };

  const doneCount = items.filter((z, i) => (counts[i] ?? 0) >= z.count).length;
  const c = counts[index] ?? 0;
  const target = current?.count ?? 1;
  const progress = Math.min(100, Math.round((c / target) * 100));
  const allDone = items.length > 0 && doneCount === items.length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold gold-gradient-text">الأذكار</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        اضغط على الدائرة لاحتساب العدّ، وسينتقل تلقائيًا إلى الذكر التالي عند الإتمام.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {[...azkarCategories.map((x) => ({ id: x.id, title: x.title })), { id: "custom", title: "أذكاري المخصّصة" }].map(
          (cat) => (
            <button
              key={cat.id}
              onClick={() => setActive(cat.id)}
              className={`rounded-xl border px-4 py-2 text-sm transition-all ${
                cat.id === active
                  ? "border-gold bg-secondary text-gold"
                  : "border-border bg-card hover:border-gold/50"
              }`}
            >
              {cat.title}
            </button>
          ),
        )}
      </div>

      <div className="surface mt-5 flex items-center justify-between p-4">
        <span className="text-sm">
          أكملت {doneCount} من {items.length} ذكرًا
        </span>
        <button
          onClick={() => {
            save({});
            setIndex(0);
          }}
          className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-xs"
        >
          <RotateCcw className="h-3.5 w-3.5" /> تصفير
        </button>
      </div>

      {isCustom && (
        <div className="surface mt-4 p-4">
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl hero-gradient px-4 py-2 text-sm font-semibold text-gold"
          >
            <Plus className="h-4 w-4" /> إضافة ذكر مخصّص
          </button>
          {showForm && (
            <div className="mt-4 space-y-3">
              <textarea
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
                placeholder="نص الذكر..."
                rows={3}
                className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-gold"
              />
              <input
                value={form.benefit}
                onChange={(e) => setForm({ ...form, benefit: e.target.value })}
                placeholder="فائدة الذكر (اختياري)"
                className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-gold"
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">عدد التكرار</span>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={form.target}
                  onChange={(e) => setForm({ ...form, target: Number(e.target.value) })}
                  className="w-24 rounded-xl border border-border bg-background p-2 text-sm"
                />
                <button onClick={addCustom} className="rounded-xl bg-secondary px-4 py-2 text-sm text-gold">
                  حفظ
                </button>
              </div>
            </div>
          )}
          {custom.length > 0 && (
            <div className="mt-4 space-y-2">
              {custom.map((z) => (
                <div key={z.id} className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2 text-sm">
                  <span className="line-clamp-1">{z.text}</span>
                  <button onClick={() => removeCustom(z.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {!user && <p className="mt-3 text-xs text-muted-foreground">سجّل الدخول لحفظ أذكارك المخصّصة.</p>}
        </div>
      )}

      {/* Sequential card */}
      {current ? (
        <div key={`${active}-${index}`} className="surface animate-fade-up mt-5 p-6 text-center sm:p-8">
          <p className="text-xs text-muted-foreground">
            الذكر {index + 1} من {items.length}
          </p>
          <p className="mt-4 text-xl leading-10">{current.text}</p>

          {current.benefit && (
            <div className="mt-5 rounded-2xl border border-gold/30 bg-secondary/50 p-4 text-right">
              <p className="flex items-center gap-2 text-sm font-bold text-gold">
                <Sparkles className="h-4 w-4" /> الفائدة
              </p>
              <p className="mt-1 text-sm leading-7 text-muted-foreground">{current.benefit}</p>
              {current.source && <p className="mt-2 text-xs text-gold/80">الدليل: {current.source}</p>}
            </div>
          )}

          <button
            onClick={tap}
            className={`mx-auto mt-7 flex h-40 w-40 select-none items-center justify-center rounded-full hero-gradient text-4xl font-bold text-gold transition-transform duration-150 ${
              pulse ? "scale-95" : "scale-100"
            }`}
          >
            {c} / {target}
          </button>

          <div className="mx-auto mt-5 h-2 max-w-xs overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${progress}%`, backgroundImage: "var(--gradient-gold)" }}
            />
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              onClick={next}
              disabled={index + 1 >= items.length}
              className="inline-flex items-center gap-1 rounded-xl bg-secondary px-4 py-2 text-sm disabled:opacity-40"
            >
              <SkipForward className="h-4 w-4" /> تخطّي
            </button>
            <button
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="inline-flex items-center gap-1 rounded-xl border border-border px-4 py-2 text-sm disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> السابق
            </button>
            <button
              onClick={() => {
                const added = toggle("zikr", `${active}-${index}`, current.text.slice(0, 80), {
                  category: active,
                  index,
                });
                toast.success(added ? "أُضيف إلى المفضلة" : "أُزيل من المفضلة");
              }}
              className={`inline-flex items-center gap-1 rounded-xl border px-4 py-2 text-sm ${
                isSaved("zikr", `${active}-${index}`) ? "border-gold text-gold" : "border-border"
              }`}
            >
              <Star className="h-4 w-4" /> حفظ
            </button>
          </div>

          {allDone && (
            <p className="mt-5 inline-flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm text-gold">
              <Check className="h-4 w-4" /> أتممت هذه الأذكار، تقبّل الله منك
            </p>
          )}
        </div>
      ) : (
        <p className="mt-8 text-center text-sm text-muted-foreground">لا توجد أذكار في هذا القسم بعد.</p>
      )}

      {/* Overview list */}
      <div className="mt-8 space-y-2">
        {items.map((z, i) => {
          const done = (counts[i] ?? 0) >= z.count;
          return (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-right text-sm transition-colors ${
                i === index ? "border-gold bg-secondary" : "border-border bg-card hover:bg-secondary/60"
              }`}
            >
              <span className="line-clamp-1">{z.text}</span>
              <span className={`shrink-0 text-xs ${done ? "text-gold" : "text-muted-foreground"}`}>
                {done ? "تم" : `${counts[i] ?? 0}/${z.count}`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
