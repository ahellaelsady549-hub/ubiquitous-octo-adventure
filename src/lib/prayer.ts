export type PrayerKey = "Fajr" | "Sunrise" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";

export const prayerNames: Record<PrayerKey, string> = {
  Fajr: "الفجر",
  Sunrise: "الشروق",
  Dhuhr: "الظهر",
  Asr: "العصر",
  Maghrib: "المغرب",
  Isha: "العشاء",
};

export const prayerOrder: PrayerKey[] = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];

export type Timings = Record<PrayerKey, string> & { date: string; hijri: string; city: string };

export async function fetchTimings(lat: number, lon: number): Promise<Timings> {
  const res = await fetch(
    `https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lon}&method=5`,
  );
  if (!res.ok) throw new Error("تعذّر جلب مواقيت الصلاة");
  const json = await res.json();
  const t = json.data.timings;
  const h = json.data.date.hijri;
  const clean = (v: string) => v.split(" ")[0]!;
  return {
    Fajr: clean(t.Fajr),
    Sunrise: clean(t.Sunrise),
    Dhuhr: clean(t.Dhuhr),
    Asr: clean(t.Asr),
    Maghrib: clean(t.Maghrib),
    Isha: clean(t.Isha),
    date: json.data.date.readable,
    hijri: `${h.day} ${h.month.ar} ${h.year} هـ`,
    city: json.data.meta.timezone,
  };
}

export function toDate(time: string, base = new Date()): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(base);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

export function nextPrayer(timings: Timings, now = new Date()) {
  const list = prayerOrder
    .filter((k) => k !== "Sunrise")
    .map((k) => ({ key: k, name: prayerNames[k], at: toDate(timings[k], now) }));
  const upcoming = list.find((p) => p.at.getTime() > now.getTime());
  if (upcoming) return upcoming;
  const first = list[0]!;
  const tomorrow = new Date(first.at);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { ...first, at: tomorrow };
}

export function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function to12h(time: string) {
  const [h, m] = time.split(":").map(Number);
  const hour = h ?? 0;
  const suffix = hour < 12 ? "ص" : "م";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${String(m ?? 0).padStart(2, "0")} ${suffix}`;
}
