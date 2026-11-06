import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { VolumeX } from "lucide-react";
import { useCoords, usePrayerTimings } from "@/lib/use-prayer";
import { prayerNames, prayerOrder, toDate, type PrayerKey } from "@/lib/prayer";
import {
  fireOnce,
  getIqama,
  iqamaGaps,
  isAdhanPlaying,
  loadPrefs,
  notify,
  playAdhan,
  stopAdhan,
  playSalawat,
  playTone,
  pushSchedule,
  registerServiceWorker,
  salawatTimesToday,
  SALAWAT_TEXT,
  setIqama,
  type ScheduledItem,
} from "@/lib/notifications";
import { fetchHadiths, hadithOfTheDay } from "@/lib/hadith";
import { tipOfTheDay } from "@/data/tips";

/** محرك التذكيرات: الصلاة، الأذان، الأذكار، حديث اليوم، والصلاة على النبي ﷺ */
export function ReminderEngine() {
  const { coords } = useCoords();
  const { data: timings } = usePrayerTimings(coords);
  const timingsRef = useRef(timings);
  timingsRef.current = timings;

  // تسجيل الـ service worker ليعمل التذكير حتى بعد إغلاق التبويب
  useEffect(() => {
    void registerServiceWorker();
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "play-sound") {
        if (e.data.sound === "salawat") playSalawat();
        if (e.data.sound === "adhan") playAdhan(false);
        if (e.data.sound === "adhan-fajr") playAdhan(true);
        if (e.data.sound === "tone") playTone();
      }
    };
    navigator.serviceWorker?.addEventListener("message", onMsg);
    return () => navigator.serviceWorker?.removeEventListener("message", onMsg);
  }, []);

  // بناء جدول اليوم وتسليمه للـ service worker (يُعاد بناؤه عند تغيير الإعدادات)
  const [prefsVersion, setPrefsVersion] = useState(0);
  useEffect(() => {
    const onChange = () => setPrefsVersion((v) => v + 1);
    window.addEventListener("emty-prefs-changed", onChange);
    return () => window.removeEventListener("emty-prefs-changed", onChange);
  }, []);

  useEffect(() => {
    if (!timings) return;
    const prefs = loadPrefs();
    const items: ScheduledItem[] = [];
    const now = new Date();


    (prayerOrder.filter((k) => k !== "Sunrise") as PrayerKey[]).forEach((key) => {
      const at = toDate(timings[key], now).getTime();
      if (prefs.prayers) {
        items.push({
          id: `pre-${key}-${now.toDateString()}`,
          at: at - prefs.beforeMinutes * 60000,
          title: `اقترب موعد صلاة ${prayerNames[key]}`,
          body: `بقي ${prefs.beforeMinutes} دقيقة على الأذان — استعد للصلاة.`,
          url: "/prayer",
          sound: "tone",
        });
        items.push({
          id: `adhan-${key}-${now.toDateString()}`,
          at,
          title: `حان الآن موعد صلاة ${prayerNames[key]}`,
          body: "حيّ على الصلاة، حيّ على الفلاح",
          url: "/prayer",
          sound: prefs.adhanSound ? (key === "Fajr" ? "adhan-fajr" : "adhan") : "tone",
          important: true,
        });
      }
    });

    if (prefs.azkar) {
      items.push({
        id: `azkar-morning-${now.toDateString()}`,
        at: toDate(timings.Fajr, now).getTime() + prefs.morningOffset * 60000,
        title: "أذكار الصباح",
        body: "حصّن يومك بأذكار الصباح.",
        url: "/azkar",
        sound: "tone",
      });
      items.push({
        id: `azkar-evening-${now.toDateString()}`,
        at: toDate(timings.Asr, now).getTime() + prefs.eveningOffset * 60000,
        title: "أذكار المساء",
        body: "حان وقت أذكار المساء، اجعل ختام يومك ذكرًا.",
        url: "/azkar",
        sound: "tone",
      });
    }

    if (prefs.salawat) {
      salawatTimesToday().forEach((t, i) => {
        items.push({
          id: `salawat-${i}-${now.toDateString()}`,
          at: t,
          title: "الصلاة على النبي ﷺ",
          body: SALAWAT_TEXT,
          url: "/",
          sound: "salawat",
        });
      });
    }

    pushSchedule(items);
  }, [timings, prefsVersion]);

  // التذكير أثناء فتح الصفحة
  useEffect(() => {
    const tick = () => {
      const prefs = loadPrefs();
      const now = new Date();
      const t = timingsRef.current;

      if (t && prefs.prayers) {
        (prayerOrder.filter((k) => k !== "Sunrise") as PrayerKey[]).forEach((key) => {
          const at = toDate(t[key], now);
          const diffMin = (at.getTime() - now.getTime()) / 60000;
          if (diffMin <= prefs.beforeMinutes && diffMin > prefs.beforeMinutes - 1.1) {
            fireOnce(`pre-${key}`, () => {
              notify(
                `اقترب موعد صلاة ${prayerNames[key]}`,
                `بقي ${prefs.beforeMinutes} دقيقة على الأذان — استعد للصلاة.`,
                `pre-${key}`,
              );
              toast(`اقترب موعد صلاة ${prayerNames[key]}`, {
                description: `بقي ${prefs.beforeMinutes} دقيقة تقريبًا`,
              });
            });
          }
          if (diffMin <= 0 && diffMin > -1.1) {
            fireOnce(`adhan-${key}`, () => {
              notify(`حان الآن موعد صلاة ${prayerNames[key]}`, "حيّ على الصلاة، حيّ على الفلاح", key);
              toast.success(`حان الآن موعد صلاة ${prayerNames[key]}`);
              if (prefs.adhanSound) playAdhan(key === "Fajr");
              setIqama(prayerNames[key], Date.now() + (iqamaGaps[key] ?? 15) * 60000);
            });
          }
        });
      }

      if (t && prefs.azkar) {
        const check = (id: string, base: string, offset: number, title: string, body: string) => {
          const at = toDate(base, now).getTime() + offset * 60000;
          const diff = (at - now.getTime()) / 60000;
          if (diff <= 0 && diff > -1.1) fireOnce(id, () => notify(title, body, id));
        };
        check("azkar-morning", t.Fajr, prefs.morningOffset, "أذكار الصباح", "حصّن يومك بأذكار الصباح.");
        check("azkar-evening", t.Asr, prefs.eveningOffset, "أذكار المساء", "حان وقت أذكار المساء، اجعل ختام يومك ذكرًا.");

      }

      if (prefs.salawat) {
        salawatTimesToday().forEach((time, i) => {
          const diff = (time - now.getTime()) / 60000;
          if (diff <= 0 && diff > -1.1) {
            fireOnce(`salawat-${i}`, () => {
              notify("الصلاة على النبي ﷺ", SALAWAT_TEXT, `salawat-${i}`);
              playSalawat();
            });
          }
        });
      }

      const hour = now.getHours();
      const minute = now.getMinutes();
      if (prefs.hadith && hour === 9 && minute < 1) {
        fireOnce("hadith-day", () => {
          void fetchHadiths().then((list) => {
            const h = hadithOfTheDay(list);
            notify("حديث اليوم", h ? h.text.slice(0, 180) : "افتح الموقع لقراءة حديث اليوم", "hadith-day");
          });
        });
      }
      if (prefs.hadith && hour === 20 && minute < 1) {
        fireOnce("tip-day", () => notify("نصيحة اليوم", tipOfTheDay(), "tip-day"));
      }
    };

    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <AdhanStopBar />
      <IqamaBanner />
    </>
  );
}

/** شريط عائم لإيقاف الأذان أثناء تشغيله من أي صفحة */
function AdhanStopBar() {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const on = (e: Event) => setPlaying(!!(e as CustomEvent<{ playing: boolean }>).detail?.playing);
    window.addEventListener("emty-adhan", on);
    setPlaying(isAdhanPlaying());
    return () => window.removeEventListener("emty-adhan", on);
  }, []);
  if (!playing) return null;
  return (
    <div className="fixed left-1/2 top-4 z-[70] flex -translate-x-1/2 items-center gap-3 rounded-full border border-gold/50 bg-card/95 py-2 pl-2 pr-4 shadow-lg backdrop-blur animate-fade-up">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-70" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gold" />
      </span>
      <span className="text-sm font-bold">الأذان يُرفع الآن</span>
      <button
        onClick={stopAdhan}
        className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-1.5 text-xs font-bold text-primary-foreground"
      >
        <VolumeX className="h-4 w-4" /> إيقاف الأذان
      </button>
    </div>
  );
}

function IqamaBanner() {
  const [iqama, setState] = useState(getIqama);
  const [, force] = useState(0);

  useEffect(() => {
    const sync = () => setState(getIqama());
    window.addEventListener("emty-iqama", sync);
    const id = setInterval(() => {
      sync();
      force((v) => v + 1);
    }, 1000);
    return () => {
      window.removeEventListener("emty-iqama", sync);
      clearInterval(id);
    };
  }, []);

  if (!iqama) return null;
  const left = Math.max(0, iqama.at - Date.now());
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);

  return (
    <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-2xl border border-gold/40 bg-card/95 px-5 py-3 text-center shadow-lg backdrop-blur">
      <p className="text-xs text-muted-foreground">المتبقي على إقامة صلاة {iqama.prayer}</p>
      <p className="mt-1 font-mono text-2xl tabular-nums text-gold">
        {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
      </p>
    </div>
  );
}
