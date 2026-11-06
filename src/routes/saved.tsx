import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Heart, ScrollText, Star } from "lucide-react";
import { useLastVisited, useSaved } from "@/lib/saved";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "المفضلة وآخر ما قرأت — أمتي" },
      { name: "description", content: "قائمة محفوظاتك من الآيات والأحاديث والأذكار مع عودة سريعة لآخر موضع توقفت عنده." },
      { property: "og:title", content: "المفضلة وآخر ما قرأت — أمتي" },
      { property: "og:description", content: "كل ما حفظته في مكان واحد." },
    ],
  }),
  component: SavedPage,
});

function SavedPage() {
  const { items } = useSaved();
  const last = useLastVisited();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="flex items-center gap-2 text-3xl font-bold gold-gradient-text">
        <Star className="h-7 w-7 text-gold" /> المفضلة
      </h1>

      <div className="surface mt-5 p-5">
        <h2 className="font-bold">عودة سريعة</h2>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link to="/quran" className="inline-flex items-center gap-2 rounded-xl bg-secondary px-4 py-2">
            <BookOpen className="h-4 w-4 text-gold" />
            {last.quran ? `سورة ${last.quran.surah} — آية ${last.quran.ayah}` : "المصحف"}
          </Link>
          <Link to="/azkar" className="inline-flex items-center gap-2 rounded-xl bg-secondary px-4 py-2">
            <Heart className="h-4 w-4 text-gold" />
            {last.azkar ? `الأذكار — الذكر ${last.azkar.index + 1}` : "الأذكار"}
          </Link>
          <Link to="/hadith" className="inline-flex items-center gap-2 rounded-xl bg-secondary px-4 py-2">
            <ScrollText className="h-4 w-4 text-gold" /> مكتبة الأحاديث
          </Link>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {items.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            لم تحفظ شيئًا بعد — استخدم زر الحفظ في المصحف والأذكار والأحاديث.
          </p>
        )}
        {items.map((i) => (
          <div key={`${i.kind}-${i.ref}`} className="surface animate-fade-up p-4">
            <p className="text-xs text-gold">
              {i.kind === "ayah"
                ? "آية"
                : i.kind === "surah"
                  ? "سورة"
                  : i.kind === "hadith"
                    ? "حديث"
                    : i.kind === "zikr"
                      ? "ذكر"
                      : "محفوظ"}
            </p>
            <p className="mt-1 text-sm leading-8">{i.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
