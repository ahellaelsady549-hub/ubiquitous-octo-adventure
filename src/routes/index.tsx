import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Clock, Heart, CircleDot, ScrollText, Sparkles, Bell, MapPin } from "lucide-react";
import { useCoords, useNow, usePrayerTimings } from "@/lib/use-prayer";
import { formatCountdown, nextPrayer, prayerNames, prayerOrder, to12h } from "@/lib/prayer";
import { fetchHadiths, hadithOfTheDay } from "@/lib/hadith";
import { tipOfTheDay } from "@/data/tips";
import { requestPermission } from "@/lib/notifications";
import { toast } from "sonner";
import { Memorial } from "@/components/Memorial";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "أمتي — رفيقك الإسلامي اليومي" },
      {
        name: "description",
        content:
          "المصحف الكامل بأصوات المنشاوي والحصري والبنا وعبد الباسط، مواقيت الصلاة، الأذكار، السبحة، والأحاديث الصحيحة.",
      },
      { property: "og:title", content: "أمتي — رفيقك الإسلامي اليومي" },
      { property: "og:description", content: "المصحف، الأذكار، مواقيت الصلاة، والأحاديث في مكان واحد." },
    ],
  }),
  component: Index,
});

const sections = [
  { to: "/quran", label: "المصحف الكامل", desc: "قراءة واستماع بأربعة قرّاء", icon: BookOpen },
  { to: "/prayer", label: "مواقيت الصلاة", desc: "حسب موقعك مع الأذان", icon: Clock },
  { to: "/azkar", label: "الأذكار", desc: "الصباح والمساء والنوم", icon: Heart },
  { to: "/tasbih", label: "السبحة", desc: "عدّاد تسبيح ذكي", icon: CircleDot },
  { to: "/hadith", label: "مكتبة الأحاديث", desc: "أكثر من ٢٠٠٠ حديث صحيح", icon: ScrollText },
] as const;

function Index() {
  const { coords } = useCoords();
  const { data: timings } = usePrayerTimings(coords);
  const now = useNow();
  const next = timings ? nextPrayer(timings, now) : null;

  const { data: hadiths } = useQuery({ queryKey: ["hadiths"], queryFn: fetchHadiths, staleTime: Infinity });
  const daily = hadiths ? hadithOfTheDay(hadiths) : null;

  const enableNotifications = async () => {
    const ok = await requestPermission();
    toast[ok ? "success" : "error"](
      ok ? "تم تفعيل التذكيرات بنجاح" : "لم يتم السماح بالإشعارات من المتصفح",
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10">
      {/* Hero */}
      <section className="relative mt-6 overflow-hidden rounded-3xl hero-gradient pattern-bg p-8 text-center sm:p-14 animate-fade-up">
        <p className="text-sm tracking-widest text-gold-soft">بسم الله الرحمن الرحيم</p>
        <h1 className="mt-3 text-5xl font-bold gold-gradient-text sm:text-6xl">أمتي</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-gold-soft/90 sm:text-base">
          رفيقك اليومي: المصحف كاملًا بأصوات كبار القرّاء، مواقيت الصلاة، الأذكار، السبحة، مكتبة
          الأحاديث، ومساعد ديني ذكي.
        </p>

        <div className="mx-auto mt-8 max-w-md rounded-2xl border border-gold/25 bg-background/25 p-6 backdrop-blur-md">
          {next ? (
            <>
              <p className="text-xs text-gold-soft">الصلاة القادمة</p>
              <p className="mt-1 font-display text-3xl font-bold text-gold">{next.name}</p>
              <p className="mt-3 font-mono text-4xl tabular-nums text-gold-soft">
                {formatCountdown(next.at.getTime() - now.getTime())}
              </p>
              {timings && (
                <p className="mt-2 text-xs text-gold-soft/80">
                  {timings.hijri} · {timings.city}
                </p>
              )}
            </>
          ) : (
            <p className="flex items-center justify-center gap-2 text-sm text-gold-soft">
              <MapPin className="h-4 w-4" /> جارٍ تحديد موقعك لعرض مواقيت الصلاة...
            </p>
          )}
        </div>

        <button
          onClick={enableNotifications}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-bold text-[oklch(0.2_0.02_165)] transition-transform hover:scale-105 active:scale-95"
        >
          <Bell className="h-4 w-4" /> فعّل تذكير الصلاة والأذكار
        </button>
      </section>

      {/* Today's timings strip */}
      {timings && (
        <section className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {prayerOrder.map((k, i) => (
            <div
              key={k}
              className="surface animate-fade-up p-3 text-center"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <p className="text-xs text-muted-foreground">{prayerNames[k]}</p>
              <p className="mt-1 text-sm font-semibold text-gold">{to12h(timings[k])}</p>
            </div>
          ))}
        </section>
      )}

      {/* Sections */}
      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s, i) => (
          <Link
            key={s.to}
            to={s.to}
            className="surface group animate-fade-up p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gold"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl hero-gradient text-gold transition-transform duration-300 group-hover:scale-110">
              <s.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-xl font-bold">{s.label}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
          </Link>
        ))}
      </section>

      {/* Hadith + tip */}
      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <article className="surface p-6">
          <div className="flex items-center gap-2 text-gold">
            <ScrollText className="h-5 w-5" />
            <h3 className="text-lg font-bold">حديث اليوم</h3>
          </div>
          <p className="mt-4 leading-9 text-foreground/90">
            {daily ? daily.text : "جارٍ تحميل حديث اليوم..."}
          </p>
          {daily && <p className="mt-3 text-xs text-muted-foreground">{daily.book}</p>}
        </article>

        <article className="surface p-6">
          <div className="flex items-center gap-2 text-gold">
            <Sparkles className="h-5 w-5" />
            <h3 className="text-lg font-bold">نصيحة اليوم</h3>
          </div>
          <p className="mt-4 text-lg leading-9">{tipOfTheDay()}</p>
        </article>
      </section>

      <Memorial />
    </div>
  );
}
