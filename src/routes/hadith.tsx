import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, ScrollText } from "lucide-react";
import { fetchHadiths } from "@/lib/hadith";

export const Route = createFileRoute("/hadith")({
  head: () => ({
    meta: [
      { title: "مكتبة الأحاديث الصحيحة — أمتي" },
      {
        name: "description",
        content: "أكثر من ٢٠٠٠ حديث نبوي صحيح من صحيح البخاري وصحيح مسلم والأربعين النووية مع بحث سريع.",
      },
      { property: "og:title", content: "مكتبة الأحاديث الصحيحة — أمتي" },
      { property: "og:description", content: "ابحث بين آلاف الأحاديث الصحيحة بسهولة." },
    ],
  }),
  component: HadithPage,
});

const PAGE = 25;

function HadithPage() {
  const { data, isLoading } = useQuery({ queryKey: ["hadiths"], queryFn: fetchHadiths, staleTime: Infinity });
  const [q, setQ] = useState("");
  const [book, setBook] = useState("الكل");
  const [page, setPage] = useState(0);

  const books = useMemo(() => ["الكل", ...new Set((data ?? []).map((h) => h.book))], [data]);

  const filtered = useMemo(() => {
    const list = data ?? [];
    return list.filter(
      (h) => (book === "الكل" || h.book === book) && (q.trim() === "" || h.text.includes(q.trim())),
    );
  }, [data, q, book]);

  const pages = Math.ceil(filtered.length / PAGE);
  const slice = filtered.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold gold-gradient-text">مكتبة الأحاديث</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {isLoading ? "جارٍ تحميل الأحاديث..." : `${filtered.length.toLocaleString("ar-EG")} حديث متاح`}
      </p>

      <div className="surface mt-5 flex flex-wrap items-center gap-3 p-4">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="ابحث في نص الحديث..."
            className="w-full rounded-xl border border-border bg-background py-2.5 pr-9 pl-3 text-sm outline-none focus:border-gold"
          />
        </div>
        <select
          value={book}
          onChange={(e) => {
            setBook(e.target.value);
            setPage(0);
          }}
          className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
        >
          {books.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 space-y-3">
        {slice.map((h, i) => (
          <article
            key={`${h.book}-${h.number}-${i}`}
            className="surface animate-fade-up p-5"
            style={{ animationDelay: `${i * 25}ms` }}
          >
            <div className="flex items-center gap-2 text-xs text-gold">
              <ScrollText className="h-3.5 w-3.5" />
              {h.book} — حديث رقم {h.number}
            </div>
            <p className="mt-3 leading-9 text-foreground/90">{h.text}</p>
          </article>
        ))}
        {!isLoading && slice.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">لا توجد نتائج مطابقة</p>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-xl border border-border px-4 py-2 text-sm disabled:opacity-40"
          >
            السابق
          </button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {pages}
          </span>
          <button
            disabled={page >= pages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-xl border border-border px-4 py-2 text-sm disabled:opacity-40"
          >
            التالي
          </button>
        </div>
      )}
    </div>
  );
}
