import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Bookmark,
  ChevronRight,
  ChevronLeft,
  Download,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Search,
  SkipForward,
  Sparkles,
  Target,
} from "lucide-react";
import {
  ayahAudioUrl,
  fetchHizb,
  fetchJuz,
  fetchPage,
  fetchSurah,
  fetchSurahList,
  fetchTafsir,
  normalizeArabic,
  reciterFolder,
  reciters,
  ruqyahPlaylist,
  ruqyahReciterFolder,
  ruqyahSections,
  searchAyahs,
  surahDownloadUrl,
  TOTAL_HIZB,
  TOTAL_JUZ,
  TOTAL_PAGES,
  type Quality,
} from "@/lib/quran";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import mushafPaper from "@/assets/mushaf-paper.jpg";

export const Route = createFileRoute("/quran")({
  head: () => ({
    meta: [
      { title: "المصحف الكامل والمفسَّر — أمتي" },
      {
        name: "description",
        content:
          "المصحف الشريف كاملًا نصًا وصوتًا بجودة عالية بأصوات المنشاوي والحصري والبنا وعبد الباسط والعفاسي وياسر الدوسري، مع التفسير الميسّر وتصفّح بالصفحات والأجزاء والأحزاب والبحث عن الآيات.",
      },
      { property: "og:title", content: "المصحف الكامل والمفسَّر — أمتي" },
      {
        property: "og:description",
        content: "اقرأ المصحف صفحةً صفحة، استمع بجودة عالية، وابحث عن أي آية مع التفسير الميسّر.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QuranPage,
});

const WARD_KEY = "emty-ward";

type Ward = { surah: number; ayah: number; target: number; today: number; date: string };
type Mode = "surah" | "page" | "juz" | "hizb";

const loadWard = (): Ward => {
  const fallback: Ward = { surah: 1, ayah: 1, target: 20, today: 0, date: new Date().toDateString() };
  if (typeof window === "undefined") return fallback;
  try {
    const w = { ...fallback, ...JSON.parse(localStorage.getItem(WARD_KEY) ?? "{}") } as Ward;
    if (w.date !== new Date().toDateString()) return { ...w, today: 0, date: new Date().toDateString() };
    return w;
  } catch {
    return fallback;
  }
};

const modes: { key: Mode; label: string }[] = [
  { key: "page", label: "المصحف" },
  { key: "surah", label: "السور" },
  { key: "juz", label: "الأجزاء" },
  { key: "hizb", label: "الأحزاب" },
];

function QuranPage() {
  const { user } = useAuth();
  const [surahNo, setSurahNo] = useState(1);
  const [mode, setMode] = useState<Mode>("page");
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const [bookmark, setBookmark] = useState<number | null>(null);
  useEffect(() => {
    const p = Number(localStorage.getItem("ummah:mushaf-page"));
    if (p >= 1 && p <= TOTAL_PAGES) setPage(p);
    const b = Number(localStorage.getItem("ummah:mushaf-bookmark"));
    if (b) setBookmark(b);
  }, []);
  useEffect(() => {
    if (mode !== "page") return;
    localStorage.setItem("ummah:mushaf-page", String(page));
    for (const n of [page + 1, page - 1])
      if (n >= 1 && n <= TOTAL_PAGES)
        void qc.prefetchQuery({ queryKey: ["range", "page", n], queryFn: () => fetchPage(n), staleTime: Infinity });
  }, [page, mode, qc]);
  const [juz, setJuz] = useState(1);
  const [hizb, setHizb] = useState(1);
  const [showList, setShowList] = useState(false);
  const [showTafsir, setShowTafsir] = useState(false);
  const [quality, setQuality] = useState<Quality>("high");
  const [search, setSearch] = useState("");
  const [ayahQuery, setAyahQuery] = useState("");
  const [reciter, setReciter] = useState(reciters[0]?.folder ?? "Minshawy_Murattal_128kbps");
  const [playingAyah, setPlayingAyah] = useState<number | null>(null);
  const [playKey, setPlayKey] = useState<number | null>(null);
  const [fontScale, setFontScale] = useState(1.7);
  useEffect(() => {
    const f = Number(localStorage.getItem("ummah:mushaf-font"));
    if (f >= 1 && f <= 2.6) setFontScale(f);
  }, []);
  const changeFont = (d: number) =>
    setFontScale((v) => {
      const n = Math.round(Math.min(2.6, Math.max(1, v + d)) * 100) / 100;
      localStorage.setItem("ummah:mushaf-font", String(n));
      return n;
    });
  // وضع القراءة الموسّع: ملء الشاشة + منع إطفاء الشاشة أثناء القراءة
  const [expanded, setExpanded] = useState(false);
  const readerScrollRef = useRef<HTMLDivElement | null>(null);
  const fsRef = useRef(false);
  useEffect(() => {
    if (!expanded) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    void nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen().then(() => (fsRef.current = true)).catch(() => {});
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    const onFs = () => {
      if (!document.fullscreenElement && fsRef.current) {
        fsRef.current = false;
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
      void lock?.release().catch(() => {});
      if (document.fullscreenElement && fsRef.current) {
        fsRef.current = false;
        void document.exitFullscreen().catch(() => {});
      }
    };
  }, [expanded]);
  const [continuous, setContinuous] = useState(true);
  const [ward, setWard] = useState<Ward>(loadWard);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const folder = reciterFolder(reciter, quality);

  const { data: list } = useQuery({ queryKey: ["surahs"], queryFn: fetchSurahList, staleTime: Infinity });
  const { data: surah, isLoading } = useQuery({
    queryKey: ["surah", surahNo],
    queryFn: () => fetchSurah(surahNo),
    staleTime: Infinity,
  });
  const { data: tafsir } = useQuery({
    queryKey: ["tafsir", surahNo],
    queryFn: () => fetchTafsir(surahNo),
    enabled: showTafsir && mode === "surah",
    staleTime: Infinity,
  });
  const { data: rangeAyahs, isLoading: rangeLoading } = useQuery({
    queryKey: ["range", mode, mode === "page" ? page : mode === "juz" ? juz : hizb],
    queryFn: () => (mode === "page" ? fetchPage(page) : mode === "juz" ? fetchJuz(juz) : fetchHizb(hizb)),
    enabled: mode !== "surah",
    staleTime: Infinity,
  });
  const { data: hits, isFetching: searching } = useQuery({
    queryKey: ["ayah-search", ayahQuery],
    queryFn: () => searchAyahs(ayahQuery),
    enabled: ayahQuery.trim().length >= 2,
    staleTime: Infinity,
  });

  useEffect(() => {
    const stored = loadWard();
    setWard(stored);
    setSurahNo(stored.surah);
  }, []);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("ward_progress")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const today = data.last_read_date === new Date().toISOString().slice(0, 10) ? data.ayahs_today : 0;
        setWard({
          surah: data.surah,
          ayah: data.ayah,
          target: data.daily_target,
          today,
          date: new Date().toDateString(),
        });
        setSurahNo(data.surah);
      });
  }, [user]);

  const persist = (next: Ward) => {
    setWard(next);
    localStorage.setItem(WARD_KEY, JSON.stringify(next));
    if (user) {
      void supabase.from("ward_progress").upsert({
        user_id: user.id,
        surah: next.surah,
        ayah: next.ayah,
        daily_target: next.target,
        ayahs_today: next.today,
        last_read_date: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      });
    }
  };

  const markRead = (ayah: number) => {
    persist({ ...ward, surah: surahNo, ayah, today: ward.today + 1, date: new Date().toDateString() });
    toast.success("تم تسجيل الآية في وردك اليوم");
  };

  const playAyah = (ayah: number, sura = surahNo, limit?: number) => {
    audioRef.current?.pause();
    const audio = new Audio(ayahAudioUrl(folder, sura, ayah));
    audioRef.current = audio;
    setPlayingAyah(ayah);
    audio.onended = () => {
      const max = limit ?? surah?.meta.numberOfAyahs ?? 0;
      if (continuous && ayah < max) playAyah(ayah + 1, sura, limit);
      else setPlayingAyah(null);
    };
    audio.onerror = () => {
      setPlayingAyah(null);
      toast.error("تعذّر تشغيل التلاوة، جرّب قارئًا آخر أو غيّر الجودة");
    };
    void audio.play();
  };

  const stop = () => {
    audioRef.current?.pause();
    setPlayingAyah(null);
  };

  useEffect(() => () => audioRef.current?.pause(), []);

  // زر عائم لإيقاف التلاوة من أي وضع قراءة
  useEffect(() => {
    if (playingAyah == null) return;
    const el = document.createElement("button");
    el.textContent = "■ إيقاف التلاوة";
    el.setAttribute("aria-label", "إيقاف تشغيل القرآن");
    el.className = "fixed bottom-20 left-1/2 z-[80] -translate-x-1/2 rounded-full bg-gold px-5 py-2 text-sm font-bold text-primary-foreground shadow-lg";
    el.onclick = () => stop();
    document.body.appendChild(el);
    return () => el.remove();
  }, [playingAyah]);

  const filtered = useMemo(() => {
    const q = normalizeArabic(search);
    if (!q) return list ?? [];
    return (list ?? []).filter(
      (s) =>
        normalizeArabic(s.name).includes(q) ||
        s.englishName.toLowerCase().includes(search.trim().toLowerCase()) ||
        String(s.number) === search.trim(),
    );
  }, [list, search]);

  const goToAyah = (sNo: number, ayah: number) => {
    setMode("surah");
    setSurahNo(sNo);
    stop();
    setTimeout(() => {
      document.getElementById(`ayah-${sNo}-${ayah}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 800);
  };

  const progress = Math.min(100, Math.round((ward.today / Math.max(1, ward.target)) * 100));
  const rangeIndex = mode === "page" ? page : mode === "juz" ? juz : hizb;
  const rangeMax = mode === "page" ? TOTAL_PAGES : mode === "juz" ? TOTAL_JUZ : TOTAL_HIZB;
  const setRangeIndex = (v: number) => {
    const n = Math.min(rangeMax, Math.max(1, v));
    if (mode === "page") setPage(n);
    else if (mode === "juz") setJuz(n);
    else setHizb(n);
  };
  const rangeLabel = mode === "page" ? "صفحة" : mode === "juz" ? "جزء" : "حزب";
  const [flipDir, setFlipDir] = useState<"next" | "prev">("next");
  const [touchX, setTouchX] = useState<number | null>(null);
  const turn = (dir: "next" | "prev") => {
    if (dir === "next" && rangeIndex >= rangeMax) return;
    if (dir === "prev" && rangeIndex <= 1) return;
    setFlipDir(dir);
    setRangeIndex(rangeIndex + (dir === "next" ? 1 : -1));
  };
  const turnRef = useRef(turn);
  turnRef.current = turn;
  useEffect(() => {
    if (mode === "surah") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      // المصحف يُقرأ من اليمين لليسار: السهم الأيسر = الصفحة التالية
      if (e.key === "ArrowLeft") turnRef.current("next");
      if (e.key === "ArrowRight") turnRef.current("prev");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);
  // في الوضع الموسّع نرجع لأعلى الصفحة الجديدة بعد التقليب
  useEffect(() => {
    if (expanded) readerScrollRef.current?.scrollTo({ top: 0 });
  }, [rangeIndex, expanded]);
  const toggleBookmark = () => {
    if (bookmark === page) {
      setBookmark(null);
      localStorage.removeItem("ummah:mushaf-bookmark");
      toast("أُزيلت العلامة");
    } else {
      setBookmark(page);
      localStorage.setItem("ummah:mushaf-bookmark", String(page));
      toast.success(`حُفظت علامة عند الصفحة ${page}`);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold gold-gradient-text">المصحف الكامل</h1>

      {/* Ward tracker */}
      <div className="surface mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-gold" />
            <h2 className="font-bold">تتبّع الورد اليومي</h2>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">الهدف اليومي</span>
            <select
              value={ward.target}
              onChange={(e) => persist({ ...ward, target: Number(e.target.value) })}
              className="rounded-lg border border-border bg-card px-2 py-1"
            >
              {[10, 20, 30, 50, 100, 200].map((v) => (
                <option key={v} value={v}>
                  {v} آية
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${progress}%`, backgroundImage: "var(--gradient-gold)" }}
          />
        </div>
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <span>
            قرأت اليوم {ward.today} من {ward.target} آية ({progress}%)
          </span>
          <button
            onClick={() => {
              setMode("surah");
              setSurahNo(ward.surah);
              toast("انتقلنا إلى آخر موضع توقفت عنده");
            }}
            className="inline-flex items-center gap-1 text-gold"
          >
            <Bookmark className="h-3.5 w-3.5" /> آخر موضع: سورة {ward.surah} — آية {ward.ayah}
          </button>
        </div>
        {!user && (
          <p className="mt-3 text-xs text-muted-foreground">
            سجّل الدخول لحفظ وردك على كل أجهزتك (اختياري).
          </p>
        )}
      </div>

      {/* Ayah search */}
      <div className="surface mt-4 p-4">
        <label className="flex items-center gap-2 text-sm font-bold text-gold">
          <Search className="h-4 w-4" /> البحث عن آية في المصحف كله
        </label>
        <input
          value={ayahQuery}
          onChange={(e) => setAyahQuery(e.target.value)}
          placeholder="اكتب جزءًا من الآية، مثل: الحمد لله رب العالمين"
          className="mt-3 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-gold"
        />
        {searching && <p className="mt-2 text-xs text-muted-foreground">جارٍ البحث في المصحف...</p>}
        {hits && hits.length > 0 && (
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {hits.map((h) => (
              <button
                key={h.key}
                onClick={() => goToAyah(h.surahNumber, h.numberInSurah)}
                className="w-full rounded-xl border border-border p-3 text-right hover:border-gold/60 hover:bg-secondary/50"
              >
                <p className="quran-text text-base leading-9">{h.text}</p>
                <p className="mt-1 text-xs text-gold">
                  {h.surahName} — آية {h.numberInSurah}
                </p>
              </button>
            ))}
          </div>
        )}
        {hits && hits.length === 0 && ayahQuery.trim().length >= 2 && !searching && (
          <p className="mt-2 text-xs text-muted-foreground">لا توجد نتائج مطابقة.</p>
        )}
      </div>

      {/* Mode tabs */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {modes.map((m) => (
          <button
            key={m.key}
            onClick={() => {
              setMode(m.key);
              stop();
            }}
            className={`rounded-xl border px-4 py-2 text-sm transition-all ${
              mode === m.key ? "border-gold bg-secondary text-gold" : "border-border bg-card hover:border-gold/50"
            }`}
          >
            {m.label}
          </button>
        ))}
        <button
          onClick={() => setShowList((v) => !v)}
          className="mr-auto inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:border-gold hover:text-gold"
        >
          {showList ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showList ? "إخفاء قائمة السور" : "إظهار قائمة السور"}
        </button>
      </div>

      <div className={`mt-4 grid gap-5 ${showList ? "lg:grid-cols-[300px_1fr]" : ""}`}>
        {/* Surah list */}
        {showList && (
          <aside className="surface h-fit p-4 lg:sticky lg:top-20">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث باسم السورة أو رقمها..."
                className="w-full rounded-xl border border-border bg-background py-2.5 pr-9 pl-3 text-sm outline-none focus:border-gold"
              />
            </div>
            <div className="mt-3 max-h-[420px] space-y-1 overflow-y-auto pl-1">
              {filtered.map((s) => (
                <button
                  key={s.number}
                  onClick={() => {
                    setSurahNo(s.number);
                    stop();
                    if (mode === "page") {
                      void fetchSurah(s.number).then((r) => {
                        const p = r.ayahs[0]?.page;
                        if (p) setPage(p);
                      });
                    } else setMode("surah");
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-right text-sm transition-colors ${
                    s.number === surahNo && mode === "surah" ? "bg-secondary text-gold" : "hover:bg-secondary/60"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-muted text-[11px]">
                      {s.number}
                    </span>
                    <span>
                      {s.name}
                      <span className="block text-[10px] text-muted-foreground">
                        {s.revelationType === "Meccan" ? "مكية" : "مدنية"}
                      </span>
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">{s.numberOfAyahs}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">لا توجد سورة بهذا الاسم.</p>
              )}
            </div>
          </aside>
        )}

        {/* Reader */}
        <section className="surface p-5 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <h2 className="flex items-center gap-2 font-display text-2xl">
              <BookOpen className="h-5 w-5 text-gold" />
              {mode === "surah" ? (surah?.meta.name ?? "...") : `${rangeLabel} ${rangeIndex}`}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={reciter}
                onChange={(e) => {
                  setReciter(e.target.value);
                  stop();
                }}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
              >
                {reciters.map((r) => (
                  <option key={r.id} value={r.folder}>
                    {r.name}
                  </option>
                ))}
              </select>
              <select
                value={quality}
                onChange={(e) => {
                  setQuality(e.target.value as Quality);
                  stop();
                }}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs"
                aria-label="جودة الاستماع"
              >
                <option value="high">جودة عالية</option>
                <option value="low">جودة أخف (بيانات أقل)</option>
              </select>
              {mode === "surah" && (
                <button
                  onClick={() => (playingAyah ? stop() : playAyah(1))}
                  className="inline-flex items-center gap-2 rounded-lg hero-gradient px-3 py-1.5 text-sm font-semibold text-gold"
                >
                  {playingAyah ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {playingAyah ? "إيقاف" : "استماع للسورة"}
                </button>
              )}
              {surahDownloadUrl(reciter, surahNo) ? (
                <a
                  href={surahDownloadUrl(reciter, surahNo)!}
                  download={`${surah?.meta.name ?? surahNo}.mp3`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-gold px-3 py-1.5 text-xs text-gold"
                >
                  <Download className="h-3.5 w-3.5" /> تحميل السورة
                </a>
              ) : (
                <span className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground">
                  التحميل غير متاح لهذا القارئ
                </span>
              )}
              <button
                onClick={() => setContinuous((v) => !v)}
                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs ${
                  continuous ? "border-gold text-gold" : "border-border text-muted-foreground"
                }`}
              >
                <SkipForward className="h-3.5 w-3.5" /> تشغيل متتابع
              </button>
              {mode === "surah" && (
                <button
                  onClick={() => setShowTafsir((v) => !v)}
                  className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs ${
                    showTafsir ? "border-gold text-gold" : "border-border text-muted-foreground"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" /> المصحف المفسَّر
                </button>
              )}
            </div>
          </div>

          {mode !== "surah" ? (
            <>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={() => turn("prev")}
                  disabled={rangeIndex <= 1}
                  className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" /> السابق
                </button>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{rangeLabel}</span>
                  <input
                    type="number"
                    min={1}
                    max={rangeMax}
                    value={rangeIndex}
                    onChange={(e) => setRangeIndex(Number(e.target.value))}
                    className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-center"
                  />
                  <span className="text-muted-foreground">من {rangeMax}</span>
                </div>
                <button
                  onClick={() => turn("next")}
                  disabled={rangeIndex >= rangeMax}
                  className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  التالي <ChevronLeft className="h-4 w-4" />
                </button>
              </div>

              <div
                className={expanded ? "fixed inset-0 z-[60] flex flex-col mushaf-ambient animate-fade-up" : ""}
                role={expanded ? "dialog" : undefined}
                aria-label={expanded ? "وضع القراءة الموسّع" : undefined}
              >
                {expanded && (
                  <>
                   <div className="flex items-center justify-between gap-2 mushaf-topbar px-3 py-2">
                    <button
                      onClick={() => setExpanded(false)}
                      className="inline-flex items-center gap-1 rounded-full border border-gold/40 px-3 py-1.5 text-xs text-gold"
                      aria-label="إغلاق وضع القراءة الموسّع"
                    >
                      <Minimize2 className="h-4 w-4" /> تصغير
                    </button>
                    <div className="flex items-center gap-1">
                      <button onClick={() => turn("prev")} disabled={rangeIndex <= 1} className="rounded-full p-2 disabled:opacity-30" aria-label="الصفحة السابقة">
                        <ChevronRight className="h-5 w-5" />
                      </button>
                      <span className="min-w-16 text-center text-sm tabular-nums text-gold">
                        {rangeLabel} {rangeIndex.toLocaleString("ar-EG")}
                      </span>
                      <button onClick={() => turn("next")} disabled={rangeIndex >= rangeMax} className="rounded-full p-2 disabled:opacity-30" aria-label="الصفحة التالية">
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <button onClick={() => changeFont(-0.1)} className="rounded-full border border-gold/40 px-2.5 py-1 text-gold" aria-label="تصغير الخط">أ−</button>
                      <button onClick={() => changeFont(0.1)} className="rounded-full border border-gold/40 px-2.5 py-1 text-gold" aria-label="تكبير الخط">أ+</button>
                    </div>
                  </div>
                  <div className="mushaf-topbar flex items-center gap-2 border-t px-4 pb-2 pt-1">
                      <input
                        type="range"
                        min={1}
                        max={rangeMax}
                        value={rangeIndex}
                        onChange={(e) => setRangeIndex(Number(e.target.value))}
                        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gold/25 accent-gold"
                        aria-label={`الانتقال السريع بين الصفحات (${rangeLabel})`}
                      />
                      <span className="min-w-10 text-center text-xs tabular-nums text-gold">{rangeIndex.toLocaleString("ar-EG")}</span>
                    </div>
                  </>
                )}
                <div ref={readerScrollRef} className={expanded ? "flex-1 overflow-y-auto px-2 py-4 sm:px-6" : ""}>
              <div className={`relative [perspective:1800px] ${expanded ? "mx-auto max-w-3xl" : "mt-6"}`}>
                {/* حواف الصفحات خلف الصفحة */}
                <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-md border border-mushaf-accent/30 bg-mushaf-paper" />
                <div className="absolute inset-0 translate-x-0.5 translate-y-0.5 rounded-md border border-mushaf-accent/30 bg-mushaf-paper" />
                <div
                  key={`${mode}-${rangeIndex}`}
                  onTouchStart={(e) => setTouchX(e.touches[0]?.clientX ?? null)}
                  onTouchEnd={(e) => {
                    if (touchX == null) return;
                    const dx = (e.changedTouches[0]?.clientX ?? touchX) - touchX;
                    if (Math.abs(dx) > 60) turn(dx > 0 ? "next" : "prev");
                    setTouchX(null);
                  }}
                  className={`mushaf-paper relative rounded-md p-1.5 sm:p-2 ${
                    expanded ? "min-h-[calc(100dvh-6rem)]" : "min-h-[70vh]"
                  } ${flipDir === "next" ? "animate-page-next" : "animate-page-prev"}`}
                >
                  <img src={mushafPaper} alt="" aria-hidden="true" width={1024} height={1024} className="mushaf-texture pointer-events-none absolute inset-0 h-full w-full rounded-md object-cover" />
                  <div className="mushaf-frame relative h-full px-3 py-3 sm:px-8 sm:py-6">
                    <div className="mb-3 flex items-center justify-between gap-2 border-b border-mushaf-accent/25 pb-2 text-[11px] text-mushaf-accent sm:text-xs">
                      <span className="font-bold">{rangeAyahs?.[0]?.juz ? `الجزء ${rangeAyahs[0].juz.toLocaleString("ar-EG")}` : `${rangeLabel} ${rangeIndex}`}</span>
                      <span className="flex items-center gap-2">
                        {mode === "page" && (
                          <button onClick={toggleBookmark} className="text-base leading-none" aria-label="علامة الصفحة" title="علامة الصفحة">
                            {bookmark === page ? "★" : "☆"}
                          </button>
                        )}
                        {!expanded && (
                          <button
                            onClick={() => setExpanded(true)}
                            className="rounded-md p-1 hover:bg-mushaf-highlight/60"
                            aria-label="توسيع القراءة"
                            title="توسيع القراءة"
                          >
                            <Maximize2 className="h-4 w-4" />
                          </button>
                        )}
                      </span>
                      <span className="truncate font-bold">{[...new Set(rangeAyahs?.map((a) => a.surahName) ?? [])].join(" · ")}</span>
                    </div>
                    {rangeLoading && (
                      <div className="space-y-4 py-6">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <div key={i} className="h-5 animate-pulse rounded bg-mushaf-highlight/50" style={{ width: `${100 - (i % 3) * 8}%`, marginInline: "auto" }} />
                        ))}
                      </div>
                    )}
                    <div
                      className="quran-text mushaf-script text-justify text-mushaf-ink [text-align-last:center]"
                      dir="rtl"
                      lang="ar"
                      style={{ fontSize: `${fontScale}rem` }}
                    >
                      {rangeAyahs?.map((a) => (
                        <span key={a.number}>
                          {a.numberInSurah === 1 && (
                            <>
                              <span className="surah-banner my-3 block py-1.5 text-center font-display text-lg">
                                سورة {a.surahName.replace(/^سُورَةُ\s*/, "")}
                              </span>
                              {a.surahNumber !== 1 && a.surahNumber !== 9 && (
                                <span className="block text-center">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</span>
                              )}
                            </>
                          )}
                          <span
                            onClick={() => {
                              setPlayKey(a.number);
                              playAyah(a.numberInSurah, a.surahNumber);
                            }}
                            className={`cursor-pointer rounded transition-colors ${
                              playKey === a.number && playingAyah ? "bg-mushaf-highlight" : "hover:bg-mushaf-highlight/60"
                            }`}
                          >
                             {a.surahNumber !== 1 && a.surahNumber !== 9 && a.numberInSurah === 1 && normalizeArabic(a.text.split(/\s+/).slice(0, 4).join(" ")) === "بسم الله الرحمن الرحيم"
                               ? a.text.split(/\s+/).slice(4).join(" ")
                               : a.text}
                          </span>
                          <span className="ayah-mark mx-0.5">{a.numberInSurah.toLocaleString("ar-EG")}</span>{" "}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-2 text-xs text-mushaf-accent">
                      <span className="h-px w-8 bg-mushaf-accent/40" />
                      {rangeIndex.toLocaleString("ar-EG")}
                      <span className="h-px w-8 bg-mushaf-accent/40" />
                    </div>
                  </div>
                  <button aria-label="الصفحة التالية" onClick={() => turn("next")} className="absolute inset-y-0 left-0 w-8 opacity-0" />
                  <button aria-label="الصفحة السابقة" onClick={() => turn("prev")} className="absolute inset-y-0 right-0 w-8 opacity-0" />
                </div>
              </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
                <button onClick={() => changeFont(-0.1)} className="rounded-full border border-border px-3 py-1" aria-label="تصغير الخط">أ−</button>
                <span>حجم الخط</span>
                <button onClick={() => changeFont(0.1)} className="rounded-full border border-border px-3 py-1" aria-label="تكبير الخط">أ+</button>
                <button
                  onClick={() => setExpanded(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gold/50 bg-secondary px-4 py-1.5 font-bold text-gold"
                >
                  <Maximize2 className="h-3.5 w-3.5" /> توسيع القراءة
                </button>
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                اسحب الصفحة أو استخدم الأسهم للتقليب — اضغط على أي آية للاستماع
              </p>
              {mode === "page" && bookmark && bookmark !== page && (
                <button onClick={() => { setFlipDir(bookmark > page ? "next" : "prev"); setPage(bookmark); }} className="mx-auto mt-2 block rounded-full border border-gold/40 px-4 py-1.5 text-xs text-gold">
                  الذهاب إلى العلامة (صفحة {bookmark})
                </button>
              )}
            </>
          ) : (
            <>
              {surahNo !== 9 && surahNo !== 1 && (
                <p className="quran-text mt-6 text-center text-gold">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
              )}

              {isLoading && <p className="mt-6 text-center text-sm text-muted-foreground">جارٍ التحميل...</p>}

              <div className="mt-4 space-y-2">
                {surah?.ayahs.map((a) => (
                  <div
                    key={a.number}
                    id={`ayah-${surahNo}-${a.numberInSurah}`}
                    className={`group rounded-2xl p-4 transition-colors ${
                      playingAyah === a.numberInSurah ? "bg-secondary" : "hover:bg-secondary/50"
                    }`}
                  >
                    <p className="quran-text text-right">
                      {a.text}
                      <span className="mx-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-gold text-sm text-gold">
                        {a.numberInSurah}
                      </span>
                    </p>
                    {showTafsir && tafsir?.[a.numberInSurah] && (
                      <p className="mt-3 rounded-xl border border-gold/25 bg-secondary/50 p-3 text-right text-sm leading-8 text-muted-foreground">
                        <span className="font-bold text-gold">التفسير الميسّر: </span>
                        {tafsir[a.numberInSurah]}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs opacity-70 transition-opacity group-hover:opacity-100">
                      <button onClick={() => playAyah(a.numberInSurah)} className="rounded-lg bg-muted px-3 py-1">
                        استماع
                      </button>
                      <button onClick={() => markRead(a.numberInSurah)} className="rounded-lg bg-muted px-3 py-1">
                        تسجيل في الورد
                      </button>
                      {a.page && (
                        <button
                          onClick={() => {
                            setMode("page");
                            setPage(a.page!);
                          }}
                          className="rounded-lg bg-muted px-3 py-1 text-muted-foreground"
                        >
                          صفحة {a.page} · جزء {a.juz}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <RuqyahPlayer quality={quality} />
    </div>
  );
}

/** الرقية الشرعية كاملة بصوت الشيخ محمد صديق المنشاوي */
function RuqyahPlayer({ quality }: { quality: Quality }) {
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playlist = useMemo(() => ruqyahPlaylist(), []);
  const folder = reciterFolder(ruqyahReciterFolder, quality);

  useEffect(() => () => audioRef.current?.pause(), []);

  const playFrom = (i: number) => {
    audioRef.current?.pause();
    const item = playlist[i];
    if (!item) {
      setPlaying(false);
      setPos(0);
      return;
    }
    const audio = new Audio(ayahAudioUrl(folder, item.surah, item.ayah));
    audioRef.current = audio;
    setPos(i);
    setPlaying(true);
    audio.onended = () => playFrom(i + 1);
    audio.onerror = () => {
      setPlaying(false);
      toast.error("تعذّر تشغيل الرقية الآن");
    };
    void audio.play();
  };

  const toggleAll = () => {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    playFrom(pos);
  };

  const playSection = (id: string) => {
    const section = ruqyahSections.find((s) => s.id === id);
    if (!section) return;
    const idx = playlist.findIndex((p) => p.surah === section.surah && p.ayah === section.from);
    if (idx >= 0) playFrom(idx);
  };

  const current = playlist[pos];
  const activeSection = ruqyahSections.find(
    (s) => current && s.surah === current.surah && current.ayah >= s.from && current.ayah <= s.to,
  );

  return (
    <section className="surface mt-10 p-6">
      <h2 className="flex items-center gap-2 text-2xl font-bold gold-gradient-text">
        <BookOpen className="h-6 w-6 text-gold" /> الرقية الشرعية كاملة
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        بصوت الشيخ محمد صديق المنشاوي — تشغيل متواصل لآيات الرقية، أو ابدأ من أي مقطع.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={toggleAll}
          className="inline-flex items-center gap-2 rounded-xl hero-gradient px-5 py-2.5 text-sm font-semibold text-gold"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {playing ? "إيقاف الرقية" : "تشغيل الرقية كاملة"}
        </button>
        {activeSection && (
          <span className="text-xs text-muted-foreground">
            يُتلى الآن: {activeSection.title} — آية {current?.ayah}
          </span>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {ruqyahSections.map((s) => (
          <button
            key={s.id}
            onClick={() => playSection(s.id)}
            className={`rounded-xl border px-3.5 py-1.5 text-xs transition-all ${
              activeSection?.id === s.id
                ? "border-gold bg-secondary text-gold"
                : "border-border bg-card hover:border-gold/50"
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>
    </section>
  );
}
