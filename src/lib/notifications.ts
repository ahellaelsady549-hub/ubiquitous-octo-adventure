
/** أذان عادي */
export const ADHAN_URL = "https://www.islamcan.com/audio/adhan/azan2.mp3";
/** أذان الفجر (فيه: الصلاة خير من النوم) */
export const FAJR_ADHAN_URL = "https://www.islamcan.com/audio/adhan/azan1.mp3";
/** الصلاة على النبي ﷺ */
export const SALAWAT_URL = "/media/salawat.mp3";
export const SALAWAT_TEXT = "اللهم صلِّ وسلِّم وبارك على نبينا محمد ﷺ";

/** المدة التقديرية بين الأذان والإقامة (بالدقائق) */
export const iqamaGaps: Record<string, number> = {
  Fajr: 20,
  Dhuhr: 15,
  Asr: 15,
  Maghrib: 10,
  Isha: 15,
};

export type NotificationPrefs = {
  prayers: boolean;
  azkar: boolean;
  hadith: boolean;
  adhanSound: boolean;
  salawat: boolean;
  tone: boolean;
  beforeMinutes: number;
  /** دقائق بعد الفجر لأذكار الصباح */
  morningOffset: number;
  /** دقائق بعد العصر لأذكار المساء */
  eveningOffset: number;
  /** عدد مرات الصلاة على النبي ﷺ يوميًا */
  salawatCount: number;
};

export const defaultPrefs: NotificationPrefs = {
  prayers: true,
  azkar: true,
  hadith: true,
  adhanSound: true,
  salawat: true,
  tone: true,
  beforeMinutes: 10,
  morningOffset: 15,
  eveningOffset: 15,
  salawatCount: 10,
};


const PREFS_KEY = "emty-notify-prefs";

export function loadPrefs(): NotificationPrefs {
  if (typeof window === "undefined") return defaultPrefs;
  try {
    return { ...defaultPrefs, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") };
  } catch {
    return defaultPrefs;
  }
}

export function savePrefs(prefs: NotificationPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  window.dispatchEvent(new CustomEvent("emty-prefs-changed"));
}


/* ------------------------- Service worker ------------------------- */

let swReg: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    swReg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    // مزامنة دورية في الخلفية (متاحة على أندرويد/كروم عند تثبيت الموقع)
    const reg = swReg as ServiceWorkerRegistration & {
      periodicSync?: { register: (tag: string, o: { minInterval: number }) => Promise<void> };
    };
    try {
      await reg.periodicSync?.register("emty-reminders", { minInterval: 15 * 60 * 1000 });
    } catch {
      /* غير مدعوم */
    }
    return swReg;
  } catch {
    return null;
  }
}

export type ScheduledItem = {
  id: string;
  at: number;
  title: string;
  body: string;
  url?: string;
  sound?: string | null;
  important?: boolean;
};

/** يسلّم جدول التذكيرات للـ service worker ليعمل حتى بعد إغلاق التبويب */
export function pushSchedule(items: ScheduledItem[]) {
  const target = navigator.serviceWorker?.controller ?? swReg?.active;
  target?.postMessage({ type: "schedule", items });
}

/* ------------------------- Notifications ------------------------- */

export async function requestPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  await registerServiceWorker();
  if (Notification.permission === "granted") return true;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function notify(title: string, body: string, tag?: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const prefs = loadPrefs();
  if (prefs.tone) playTone();
  const options: NotificationOptions = {
    body,
    ...(tag ? { tag } : {}),
    icon: "/favicon.ico",
    dir: "rtl",
    lang: "ar",
  };
  const reg = swReg ?? null;
  if (reg) {
    void reg.showNotification(title, { ...options, ...({ vibrate: [180, 80, 180] } as object) });
    return;
  }
  try {
    new Notification(title, options);
  } catch {
    /* ignore */
  }
}

/* ------------------------- Audio ------------------------- */

let ctx: AudioContext | null = null;

/** نغمة تنبيه قصيرة تُشغَّل مع كل إشعار */
export function playTone() {
  if (typeof window === "undefined") return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx ??= new AC();
    void ctx.resume();
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.22 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.22 + 0.2);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(now + i * 0.22);
      osc.stop(now + i * 0.22 + 0.22);
    });
  } catch {
    /* ignore */
  }
}

const firedKey = (id: string) => `emty-fired-${id}-${new Date().toDateString()}`;

export function fireOnce(id: string, fn: () => void) {
  if (typeof window === "undefined") return;
  const key = firedKey(id);
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, "1");
  fn();
}

let adhanAudio: HTMLAudioElement | null = null;
let salawatAudio: HTMLAudioElement | null = null;

const emitAdhan = (playing: boolean) =>
  window.dispatchEvent(new CustomEvent("emty-adhan", { detail: { playing } }));

export function isAdhanPlaying() {
  return !!adhanAudio && !adhanAudio.paused && !adhanAudio.ended;
}

export function playAdhan(isFajr = false) {
  if (typeof window === "undefined") return;
  try {
    adhanAudio?.pause();
    const a = new Audio(isFajr ? FAJR_ADHAN_URL : ADHAN_URL);
    adhanAudio = a;
    a.addEventListener("ended", () => emitAdhan(false));
    a.addEventListener("pause", () => emitAdhan(false));
    a.addEventListener("playing", () => emitAdhan(true));
    void a.play().catch(() => emitAdhan(false));
    emitAdhan(true);
  } catch {
    /* ignore */
  }
}

export function stopAdhan() {
  if (typeof window === "undefined") return;
  if (adhanAudio) {
    adhanAudio.pause();
    adhanAudio.currentTime = 0;
  }
  emitAdhan(false);
}

export function playSalawat() {
  if (typeof window === "undefined") return;
  try {
    salawatAudio ??= new Audio(SALAWAT_URL);
    salawatAudio.currentTime = 0;
    void salawatAudio.play();
  } catch {
    /* ignore */
  }
}

/* ------------------------- مواعيد الصلاة على النبي ﷺ ------------------------- */

const SALAWAT_KEY = "emty-salawat-times";

/** تذكير كل ساعة من ٧ صباحًا حتى ١١ مساءً */
export function salawatTimesToday(): number[] {
  if (typeof window === "undefined") return [];
  const base = new Date();
  base.setHours(7, 0, 0, 0);
  const times: number[] = [];
  for (let m = 0; m <= 16 * 60; m += 60) times.push(base.getTime() + m * 60000);
  return times;
}


/* ------------------------- عدّاد الإقامة ------------------------- */

const IQAMA_KEY = "emty-iqama";

export function setIqama(prayer: string, at: number) {
  localStorage.setItem(IQAMA_KEY, JSON.stringify({ prayer, at }));
  window.dispatchEvent(new CustomEvent("emty-iqama"));
}

export function getIqama(): { prayer: string; at: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const v = JSON.parse(localStorage.getItem(IQAMA_KEY) ?? "null");
    if (!v || v.at < Date.now()) return null;
    return v;
  } catch {
    return null;
  }
}
