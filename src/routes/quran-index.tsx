import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchSurahList, normalizeArabic, TOTAL_PAGES } from "@/lib/quran";

export const Route = createFileRoute("/quran-index")({
  head: () => ({
    meta: [
      { title: "فهرس المصحف — أمتي" },
      { name: "description", content: "فهرس السور المكية والمدنية والأجزاء والأحزاب وصفحاتها في المصحف العثماني." },
      { property: "og:title", content: "فهرس المصحف — أمتي" },
      { property: "og:description", content: "السور والأجزاء والأحزاب مع رقم صفحتها في المصحف." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuranIndex,
});

type Ref = { surah: number; ayah: number };
type Meta = { pages: Ref[]; juzs: Ref[]; quarters: Ref[] };

async function fetchMeta(): Promise<Meta> {
  const res = await fetch("https://api.alquran.cloud/v1/meta");
  if (!res.ok) throw new Error("تعذّر تحميل الفهرس");
  const d = (await res.json()).data;
  return { pages: d.pages.references, juzs: d.juzs.references, quarters: d.hizbQuarters.references };
}

/** رقم الصفحة التي يقع فيها موضع معيّن */
function pageOf(pages: Ref[], r: Ref) {
  let p = 1;
  for (let i = 0; i < pages.length; i++) {
    const x = pages[i]!;
    if (x.surah < r.surah || (x.surah === r.surah && x.ayah <= r.ayah)) p = i + 1;
    else break;
  }
  return Math.min(p, TOTAL_PAGES);
}

const tabs = [
  { id: "all", label: "كل السور" },
  { id: "Meccan", label: "المكية" },
  { id: "Medinan", label: "المدنية" },
  { id: "juz", label: "الأجزاء" },
  { id: "hizb", label: "الأحزاب" },
] as const;

function QuranIndex() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("all");
  const [q, setQ] = useState("");
  const { data: surahs } = useQuery({ queryKey: ["surah-list"], queryFn: fetchSurahList, staleTime: Infinity });
  const { data: meta, isError } = useQuery({ queryKey: ["quran-meta"], queryFn: fetchMeta, staleTime: Infinity });

  const open = (page: number) => {
    localStorage.setItem("ummah:mushaf-page", String(page));
    void navigate({ to: "/quran" });
  };

  const rows = useMemo(() => {
    if (!meta) return [];
    if (tab === "juz")
      return meta.juzs.map((r, i) => ({ key: `j${i}`, n: i + 1, title: `الجزء ${i + 1}`, sub: "", page: pageOf(meta.pages, r) }));
    if (tab === "hizb")
      return meta.quarters
        .filter((_, i) => i % 4 === 0)
        .map((r, i) => ({ key: `h${i}`, n: i + 1, title: `الحزب ${i + 1}`, sub: `الجزء ${Math.ceil((i + 1) / 2)}`, page: pageOf(meta.pages, r) }));
    const term = normalizeArabic(q);
    return (surahs ?? [])
      .filter((s) => tab === "all" || s.revelationType === tab)
      .filter((s) => !term || normalizeArabic(s.name).includes(term) || String(s.number) === q.trim())
      .map((s) => ({
        key: `s${s.number}`,
        n: s.number,
        title: s.name,
        sub: `${s.revelationType === "Meccan" ? "مكية" : "مدنية"} · ${s.numberOfAyahs} آية`,
        page: pageOf(meta.pages, { surah: s.number, ayah: 1 }),
      }));
  }, [meta, surahs, tab, q]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8" dir="rtl">
      <h1 className="text-2xl font-bold text-gold">فهرس المصحف</h1>
      <p className="mt-1 text-sm text-muted-foreground">اضغط على أي سورة أو جزء أو حزب لفتح صفحته في المصحف.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full border px-4 py-1.5 text-sm ${tab === t.id ? "border-gold bg-gold text-primary-foreground" : "border-border"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab !== "juz" && tab !== "hizb" && (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث باسم السورة أو رقمها"
          className="mt-4 w-full rounded-xl border border-border bg-card px-4 py-2 text-sm"
        />
      )}
      {isError && <p className="mt-6 text-center text-sm text-muted-foreground">تعذّر تحميل الفهرس، تأكد من الاتصال.</p>}
      {!meta && !isError && <p className="mt-6 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>}
      <ul className="mt-5 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {rows.map((r) => (
          <li key={r.key}>
            <button onClick={() => open(r.page)} className="flex w-full items-center gap-3 px-4 py-3 text-right hover:bg-secondary">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/50 text-xs text-gold">{r.n}</span>
              <span className="flex-1">
                <span className="block font-quran text-lg" style={{ fontFamily: "var(--font-quran)" }}>{r.title}</span>
                {r.sub && <span className="block text-xs text-muted-foreground">{r.sub}</span>}
              </span>
              <span className="text-xs text-muted-foreground">صفحة {r.page}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
