import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, MapPin, Play, Square, Volume2 } from "lucide-react";
import { useCoords, useNow, usePrayerTimings } from "@/lib/use-prayer";
import { formatCountdown, nextPrayer, prayerNames, prayerOrder, to12h } from "@/lib/prayer";
import {
  loadPrefs,
  playAdhan,
  requestPermission,
  savePrefs,
  stopAdhan,
  type NotificationPrefs,
} from "@/lib/notifications";
import { toast } from "sonner";

export const Route = createFileRoute("/prayer")({
  head: () => ({
    meta: [
      { title: "مواقيت الصلاة — أمتي" },
      { name: "description", content: "مواقيت الصلاة حسب موقعك الجغرافي مع عدّاد تنازلي وتشغيل الأذان." },
      { property: "og:title", content: "مواقيت الصلاة — أمتي" },
      { property: "og:description", content: "مواقيت دقيقة حسب موقعك مع تذكير قبل الصلاة والأذان." },
    ],
  }),
  component: PrayerPage,
});

function PrayerPage() {
  const { coords, error } = useCoords();
  const { data: timings, isLoading } = usePrayerTimings(coords);
  const now = useNow();
  const [prefs, setPrefs] = useState<NotificationPrefs>(loadPrefs);

  useEffect(() => setPrefs(loadPrefs()), []);

  const update = (patch: Partial<NotificationPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePrefs(next);
  };

  const next = timings ? nextPrayer(timings, now) : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold gold-gradient-text">مواقيت الصلاة</h1>
      <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
        <MapPin className="h-4 w-4" />
        {error ?? (timings ? `${timings.city} · ${timings.hijri}` : "جارٍ تحديد الموقع...")}
      </p>

      {next && (
        <div className="mt-6 rounded-3xl hero-gradient pattern-bg p-8 text-center animate-fade-up">
          <p className="text-xs text-gold-soft">متبقٍ على صلاة</p>
          <p className="mt-1 font-display text-4xl font-bold text-gold">{next.name}</p>
          <p className="mt-3 font-mono text-5xl tabular-nums text-gold-soft">
            {formatCountdown(next.at.getTime() - now.getTime())}
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {isLoading && <p className="text-sm text-muted-foreground">جارٍ تحميل المواقيت...</p>}
        {timings &&
          prayerOrder.map((k, i) => {
            const active = next?.key === k;
            return (
              <Link
                key={k}
                to="/azkar"
                search={{ cat: "after-prayer" }}
                className={`surface flex animate-fade-up items-center justify-between p-4 transition-colors hover:border-gold ${
                  active ? "border-gold glow" : ""
                }`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span>
                  <span className="block font-display text-xl">{prayerNames[k]}</span>
                  {k !== "Sunrise" && <span className="text-[11px] text-muted-foreground">اضغط لأذكار بعد الصلاة</span>}
                </span>
                <span className={`text-lg font-semibold ${active ? "text-gold" : ""}`}>
                  {to12h(timings[k])}
                </span>
              </Link>
            );
          })}
      </div>

      <div className="surface mt-8 p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Bell className="h-5 w-5 text-gold" /> إعدادات التذكير
        </h2>

        <div className="mt-4 space-y-3">
          <Toggle
            label="تذكير بمواعيد الصلاة"
            value={prefs.prayers}
            onChange={(v) => update({ prayers: v })}
          />
          <Toggle
            label="تشغيل الأذان عند دخول الوقت"
            value={prefs.adhanSound}
            onChange={(v) => update({ adhanSound: v })}
          />
          <Toggle
            label="تذكير بأذكار الصباح والمساء"
            value={prefs.azkar}
            onChange={(v) => update({ azkar: v })}
          />
          <Toggle
            label="إشعار حديث اليوم ونصيحة اليوم"
            value={prefs.hadith}
            onChange={(v) => update({ hadith: v })}
          />

          <div className="flex items-center justify-between rounded-xl bg-secondary/60 px-4 py-3">
            <span className="text-sm">التذكير قبل الأذان بـ</span>
            <select
              value={prefs.beforeMinutes}
              onChange={(e) => update({ beforeMinutes: Number(e.target.value) })}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
            >
              {[5, 10, 15, 20, 30].map((m) => (
                <option key={m} value={m}>
                  {m} دقيقة
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={async () => {
              const ok = await requestPermission();
              toast[ok ? "success" : "error"](ok ? "تم تفعيل الإشعارات" : "لم يُسمح بالإشعارات");
            }}
            className="inline-flex items-center gap-2 rounded-xl hero-gradient px-4 py-2.5 text-sm font-semibold text-gold"
          >
            <Bell className="h-4 w-4" /> تفعيل الإشعارات
          </button>
          <button
            onClick={() => playAdhan()}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm"
          >
            <Play className="h-4 w-4" /> تجربة الأذان
          </button>
          <button
            onClick={stopAdhan}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm"
          >
            <Square className="h-4 w-4" /> إيقاف
          </button>
        </div>

        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <Volume2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          لتصلك التذكيرات في وقتها اترك صفحة الموقع مفتوحة في المتصفح واسمح بالإشعارات.
        </p>
      </div>
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between rounded-xl bg-secondary/60 px-4 py-3 text-right transition-colors hover:bg-secondary"
    >
      <span className="text-sm">{label}</span>
      <span
        className={`relative h-6 w-11 rounded-full transition-colors ${
          value ? "bg-gold" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-card transition-all ${
            value ? "right-1" : "right-6"
          }`}
        />
      </span>
    </button>
  );
}
