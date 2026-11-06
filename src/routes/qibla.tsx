import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Compass, MapPin } from "lucide-react";
import { useCoords } from "@/lib/use-prayer";
import { Button } from "@/components/ui/button";
import { angleDelta, screenHeading, wrapAngle } from "@/lib/compass";

export const Route = createFileRoute("/qibla")({
  head: () => ({
    meta: [
      { title: "اتجاه القبلة — أمتي" },
      {
        name: "description",
        content:
          "بوصلة القبلة الدقيقة حسب موقعك مع اتجاه الكعبة والمسجد النبوي والمسجد الأقصى وموضع الشروق والمسافة بينك وبينها.",
      },
      { property: "og:title", content: "اتجاه القبلة — أمتي" },
      { property: "og:description", content: "بوصلة تحدد القبلة والمدينة والأقصى والمشرق مع المسافة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QiblaPage,
});

function Icon({ id, className = "" }: { id: string; className?: string }) {
  const c = `h-4 w-4 ${className}`;
  if (id === "kaaba")
    return (
      <svg viewBox="0 0 24 24" className={c} fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M4 7.5 12 4l8 3.5V17l-8 3.5L4 17z" />
        <path d="M4 9.5h16" strokeWidth="2.4" />
      </svg>
    );
  if (id === "madinah")
    return (
      <svg viewBox="0 0 24 24" className={c} fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M5 20v-7a7 7 0 0 1 14 0v7z" />
        <path d="M12 6c1.6-1.4 1.6-2.6 0-4-1.6 1.4-1.6 2.6 0 4Z" />
        <path d="M3 20h18M8 20v-4h8v4" />
      </svg>
    );
  if (id === "aqsa")
    // قبة الصخرة: قبة ذهبية على مبنى مثمّن
    return (
      <svg viewBox="0 0 24 24" className={c} fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M12 2.6v1.6" />
        <path d="M6.6 11a5.4 5.4 0 0 1 10.8 0z" fill="currentColor" fillOpacity="0.35" />
        <path d="M5 11h14v3H5z" />
        <path d="M6.5 14v6M17.5 14v6M12 20v-4M3.5 20h17" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className={c} fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="14" r="4" fill="currentColor" fillOpacity="0.35" />
      <path d="M3 19h18M12 6v2M5.5 9 7 10.2M18.5 9 17 10.2" />
    </svg>
  );
}

const targets = [
  { id: "kaaba", label: "الكعبة المشرّفة", short: "الكعبة", lat: 21.4225, lon: 39.8262 },
  { id: "madinah", label: "المسجد النبوي", short: "المدينة", lat: 24.4672, lon: 39.6112 },
  { id: "aqsa", label: "قبة الصخرة والأقصى", short: "الأقصى", lat: 31.778, lon: 35.2354 },
] as const;

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

function bearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

/** اتجاه شروق الشمس تقريبًا حسب اليوم والموقع */
function sunriseAzimuth(lat: number, date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0);
  const day = Math.floor((date.getTime() - start.getTime()) / 86400000);
  const decl = 23.44 * Math.sin(toRad((360 / 365) * (day - 81)));
  const cosA =
    Math.sin(toRad(decl)) / Math.cos(toRad(lat));
  const clamped = Math.max(-1, Math.min(1, cosA));
  return (toDeg(Math.acos(clamped)) + 360) % 360;
}

function screenAngle() {
  const so = typeof window !== "undefined" ? window.screen?.orientation : undefined;
  if (so && typeof so.angle === "number") return so.angle;
  return typeof window.orientation === "number" ? window.orientation : 0;
}

const CAL_KEY = "ummah:qibla-calibration";

function QiblaPage() {
  const { coords, error } = useCoords();
  const [heading, setHeading] = useState<number | null>(null);
  const [sensorIssue, setSensorIssue] = useState("جارٍ انتظار قراءة البوصلة");
  const [sensorEpoch, setSensorEpoch] = useState(0);
  const [manualHeading, setManualHeading] = useState(0);
  const [calibration, setCalibration] = useState(0);
  const [needsPermission, setNeedsPermission] = useState(false);
  const attachRef = useRef<() => void>(() => {});
  const rotRef = useRef(0);

  useEffect(() => {
    const saved = Number(localStorage.getItem(CAL_KEY) ?? "0");
    if (Number.isFinite(saved) && Math.abs(saved) <= 30) setCalibration(saved);
  }, []);

  useEffect(() => {
    if (typeof DeviceOrientationEvent === "undefined") {
      setSensorIssue("حساس البوصلة غير متاح في هذا المتصفح");
      return;
    }
    let cleanup = () => {};
    // الهدف الخام من الحساس، والقيمة المعروضة تُنعَّم في حلقة رسم مستقلة
    let target: number | null = null;
    let shown: number | null = null;
    let raf = 0;
    let lastPush = 0;
    let lastFrame = 0;
    let lastReading = 0;
    let source: "webkit" | "absolute" | null = null;
    let samples: number[] = [];
    setHeading(null);

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(100, lastFrame ? t - lastFrame : 16);
      lastFrame = t;
      if (lastReading && t - lastReading > 2000) {
        target = shown = null;
        setHeading(null);
        setSensorIssue("توقفت قراءة الحساس — أعد تفعيل البوصلة");
        lastReading = 0;
      }
      if (target == null) return;
      if (shown == null) shown = target;
      else {
        const d = angleDelta(target, shown);
        // Time-based damping and a fixed dead band: stationary noise cannot accumulate.
        if (Math.abs(d) > 1.5) {
          const k = 1 - Math.exp(-dt / (Math.abs(d) > 20 ? 90 : 220));
          shown = wrapAngle(shown + d * k);
        }
      }
      if (t - lastPush > 33) {
        lastPush = t;
        setHeading(shown);
      }
    };

    const attach = () => {
      cleanup();
      const handler = (e: Event) => {
        const ev = e as DeviceOrientationEvent & {
          webkitCompassHeading?: number;
          webkitCompassAccuracy?: number;
        };
        let raw: number | null = null;
        let nextSource: typeof source = null;
        if (typeof ev.webkitCompassHeading === "number" && Number.isFinite(ev.webkitCompassHeading)) {
          if (typeof ev.webkitCompassAccuracy === "number" && (ev.webkitCompassAccuracy < 0 || ev.webkitCompassAccuracy > 25)) {
            target = shown = null;
            samples = [];
            setHeading(null);
            setSensorIssue("دقة الحساس ضعيفة — أبعد الهاتف عن المغناطيس وعايره بحركة ٨");
            return;
          }
          raw = ev.webkitCompassHeading + screenAngle();
          nextSource = "webkit";
        } else if (source !== "webkit" && (ev.absolute === true || e.type === "deviceorientationabsolute") && ev.alpha != null && Number.isFinite(ev.alpha)) {
          raw = screenHeading(ev.alpha, ev.beta ?? 0, ev.gamma ?? 0, screenAngle());
          nextSource = "absolute";
          if (raw == null) {
            target = shown = null;
            samples = [];
            setHeading(null);
            setSensorIssue("الهاتف مائل بشدة — ضعه مسطحًا لقراءة الاتجاه");
            return;
          }
        } else if (source == null) {
          setSensorIssue("لا توجد قراءة مرتبطة بالشمال — البوصلة اليدوية فقط متاحة");
        }
        if (raw == null) return;
        if (source !== nextSource) {
          samples = [];
          target = shown = null;
        }
        source = nextSource;
        lastReading = performance.now();
        raw = wrapAngle(raw);
        samples = [...samples.slice(-4), raw];
        if (samples.length < 3) return;
        const offsets = samples.map((v) => angleDelta(v, raw)).sort((a, b) => a - b);
        target = wrapAngle(raw + (offsets[Math.floor(offsets.length / 2)] ?? 0));
        setSensorIssue("");
      };
      const onCalibration = () => {
        target = shown = null;
        samples = [];
        setHeading(null);
        setSensorIssue("الحساس يحتاج معايرة — حرّك الهاتف بحركة ٨ بعيدًا عن المعدن");
      };
      window.addEventListener("deviceorientation", handler, true);
      window.addEventListener("deviceorientationabsolute", handler, true);
      window.addEventListener("compassneedscalibration", onCalibration);
      raf = requestAnimationFrame(loop);
      cleanup = () => {
        window.removeEventListener("deviceorientation", handler, true);
        window.removeEventListener("deviceorientationabsolute", handler, true);
        window.removeEventListener("compassneedscalibration", onCalibration);
        cancelAnimationFrame(raf);
      };
    };
    attachRef.current = attach;

    const anyOrientation = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };
    if (typeof anyOrientation?.requestPermission === "function") {
      setNeedsPermission(true);
    } else {
      attach();
    }
    return () => cleanup();
  }, [sensorEpoch]);

  const askPermission = async () => {
    if (typeof DeviceOrientationEvent === "undefined") return;
    const anyOrientation = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };
    try {
      const res = await anyOrientation.requestPermission?.();
      if (res === "granted") {
        setNeedsPermission(false);
        attachRef.current();
      } else setSensorIssue("لم يُسمح باستخدام حساس البوصلة");
    } catch {
      setSensorIssue("تعذّر تفعيل الحساس — تحقق من إذن البوصلة في المتصفح");
    }
  };

  const updateCalibration = (v: number) => {
    setCalibration(v);
    localStorage.setItem(CAL_KEY, String(v));
  };

  const trueHeading = heading == null ? null : (heading + calibration + 360) % 360;

  const activeHeading = trueHeading ?? (manualHeading + calibration + 360) % 360;
  // زاوية متصلة بلا قفزة عند 0/360 حتى لا يلف القرص دورة كاملة
  {
    const d = ((activeHeading - rotRef.current + 540) % 360) - 180;
    rotRef.current = rotRef.current + d;
  }
  const rot = rotRef.current;




  const points = coords
    ? [
        ...targets.map((t) => ({
          ...t,
          angle: bearing(coords.lat, coords.lon, t.lat, t.lon),
          km: distanceKm(coords.lat, coords.lon, t.lat, t.lon),
        })),
        {
          id: "sunrise",
          label: "موضع الشروق",
          
          short: "الشروق",
          angle: sunriseAzimuth(coords.lat),
          km: null as number | null,
        },
      ]
    : [];

  const diff = (a: number) => Math.abs(((a - activeHeading + 540) % 360) - 180);

  const qibla = points.find((p) => p.id === "kaaba");

  const aligned = qibla && heading != null && !error ? diff(qibla.angle) < 5 : false;
  const near = qibla && heading != null && !error ? diff(qibla.angle) < 15 : false;

  return (
    <div className="mx-auto max-w-md px-4 pb-24 pt-6 sm:max-w-lg">
      <header className="text-center">
        <h1 className="text-2xl font-bold gold-gradient-text sm:text-3xl">اتجاه القبلة</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          امسك الهاتف أفقيًا ودُر ببطء حتى يستقر المؤشر على الكعبة
        </p>
      </header>

      {error && <p className="mt-3 text-center text-[11px] text-muted-foreground">{error}</p>}
      {needsPermission && (
        <Button
          onClick={askPermission}
          className="mx-auto mt-4 flex items-center gap-2 px-6 py-3 text-sm font-bold"
        >
          <Compass className="h-4 w-4" /> تفعيل البوصلة
        </Button>
      )}

      {!coords ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <span className="h-14 w-14 animate-spin rounded-full border-2 border-gold/25 border-t-gold" />
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4" /> جارٍ تحديد موقعك...
          </span>
        </div>
      ) : (
        <>
          {/* حالة المحاذاة */}
          <div className="mt-5 flex justify-center">
            <span
              className={`rounded-full px-5 py-2 text-xs font-bold transition-colors ${
                aligned
                  ? "bg-gold/20 text-gold animate-pulse-ring"
                  : near
                    ? "bg-gold/10 text-gold-soft"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {error ? "موقعك الحالي غير مؤكد" : heading == null ? "الوضع اليدوي — اتجاه الهاتف غير مؤكد" : aligned ? "أنت الآن باتجاه القبلة ✓" : near ? "اقتربت… أكمل الدوران" : "دُر ببطء للعثور على القبلة"}
            </span>
          </div>

          {/* البوصلة */}
          <div className="relative mx-auto mt-6 aspect-square w-full max-w-[340px]">
            {/* مؤشر ثابت أعلى */}
            <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1">
              <div
                className={`h-0 w-0 border-x-[9px] border-b-[16px] border-x-transparent transition-colors duration-300 ${
                  aligned ? "border-b-gold" : "border-b-gold/60"
                }`}
              />
            </div>

            {/* هالة عند المحاذاة */}
            {aligned && (
              <div className="absolute inset-0 animate-ping rounded-full border border-gold/30 [animation-duration:2.4s]" />
            )}

            <div
              className={`absolute inset-0 rounded-full border hero-gradient transition-all duration-500 ${
                aligned
                  ? "border-gold shadow-[0_0_70px_-10px_var(--gold)]"
                  : "border-gold/25 shadow-[var(--shadow-soft)]"
              }`}
            />
            <div className="absolute inset-[6%] rounded-full border border-gold/10" />
            <div className="absolute inset-[20%] rounded-full border border-gold/10" />
            <div className="absolute inset-[34%] rounded-full border border-dashed border-gold/10" />

            {/* القرص الدوّار */}
            <div
              className="absolute inset-0 will-change-transform"
              style={{ transform: `rotate(${-rot}deg)` }}
            >
              {/* شرطات الدرجات */}
              {Array.from({ length: 72 }).map((_, i) => {
                const major = i % 6 === 0;
                return (
                  <div key={i} className="absolute inset-0" style={{ transform: `rotate(${i * 5}deg)` }}>
                    <span
                      className={`absolute left-1/2 -translate-x-1/2 rounded-full ${
                        major ? "top-[3.5%] h-[4%] w-[2px] bg-gold/60" : "top-[4%] h-[2%] w-px bg-gold/25"
                      }`}
                    />
                  </div>
                );
              })}

              {/* الجهات */}
              {[
                { d: "ش", a: 0 },
                { d: "ق", a: 90 },
                { d: "ج", a: 180 },
                { d: "غ", a: 270 },
              ].map(({ d, a }) => (
                <div key={d} className="absolute inset-0" style={{ transform: `rotate(${a}deg)` }}>
                  <span
                    className={`absolute left-1/2 top-[8.5%] block -translate-x-1/2 text-[11px] font-bold ${
                      a === 0 ? "text-gold" : "text-muted-foreground"
                    }`}
                    style={{ transform: `translateX(-50%) rotate(${rot - a}deg)` }}
                  >
                    {d}
                  </span>
                </div>
              ))}

              {points.map((p) => {
                const on = diff(p.angle) < 10;
                return (
                  <div key={p.id} className="absolute inset-0" style={{ transform: `rotate(${p.angle}deg)` }}>
                    {p.id === "kaaba" && (
                      <span
                        className={`absolute bottom-1/2 left-1/2 w-[3px] -translate-x-1/2 rounded-full transition-all duration-500 ${
                          on ? "h-[32%] bg-gradient-to-t from-transparent to-gold" : "h-[28%] bg-gradient-to-t from-transparent to-gold/40"
                        }`}
                      />
                    )}
                    <span
                      className={`absolute left-1/2 top-[15%] flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold backdrop-blur transition-all duration-500 ${
                        on
                          ? "bg-gold/25 text-gold opacity-100 shadow-[0_0_22px_2px_color-mix(in_oklab,var(--gold)_45%,transparent)]"
                          : "bg-background/50 text-foreground/60 opacity-70"
                      }`}
                      style={{
                        transform: `translateX(-50%) rotate(${rot - p.angle}deg) scale(${on ? 1.1 : 1})`,
                      }}
                    >
                      <Icon id={p.id} className="h-3.5 w-3.5" />
                      {p.short}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* القراءة المركزية */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
              <span
                className={`flex h-16 w-16 items-center justify-center rounded-full border transition-all duration-500 ${
                  aligned
                    ? "scale-110 border-gold bg-gold/15 text-gold shadow-[0_0_34px_-4px_var(--gold)]"
                    : "border-gold/25 bg-background/40 text-gold-soft"
                }`}
              >
                <Icon id="kaaba" className="h-8 w-8" />
              </span>
              <span className="text-[11px] text-gold-soft tabular-nums">
                {qibla?.km} كم إلى الكعبة
              </span>
            </div>
          </div>


          <p className="mt-4 text-center text-xs text-muted-foreground">
            {trueHeading == null
              ? "بوصلة الجهاز غير متاحة — حرّك المؤشر يدويًا حتى يوافق الشمال"
              : `اتجاه جهازك: ${Math.round(trueHeading / 5) * 5}° تقريبًا · قراءة الحساس المغناطيسي`}
          </p>
          {sensorIssue && <p role="status" className="mt-2 text-center text-xs text-muted-foreground">{sensorIssue}</p>}
          {!needsPermission && <Button variant="outline" size="sm" onClick={() => setSensorEpoch((v) => v + 1)} className="mx-auto mt-3 flex"><Compass className="h-4 w-4" /> إعادة تفعيل البوصلة</Button>}

          {trueHeading == null && (
            <div className="mx-auto mt-3 flex w-full max-w-xs items-center gap-3">
              <input
                type="range"
                min={0}
                max={359}
                value={Math.round(manualHeading)}
                onChange={(e) => setManualHeading(Number(e.target.value))}
                className="w-full accent-[var(--gold)]"
                aria-label="تحريك البوصلة يدويًا"
              />
              <span className="w-12 text-center text-xs text-gold tabular-nums">
                {Math.round(manualHeading)}°
              </span>
            </div>
          )}

          <div className="surface mx-auto mt-4 w-full max-w-xs p-3">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>ضبط دقيق (فارق الشمال)</span>
              <span className="text-gold tabular-nums">
                {calibration > 0 ? "+" : ""}
                {calibration}°
              </span>
            </div>
            <input
              type="range"
              min={-30}
              max={30}
              value={calibration}
              onChange={(e) => updateCalibration(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--gold)]"
              aria-label="ضبط دقيق لاتجاه الشمال"
            />
            <Button
              variant="outline" size="sm"
              onClick={() => { updateCalibration(0); setSensorEpoch((v) => v + 1); }}
              className="mt-2 w-full text-[11px]"
            >
              إعادة الضبط
            </Button>
          </div>


          <div className="mt-6 grid grid-cols-2 gap-3">
            {points.map((p) => {
              const on = diff(p.angle) < 12;
              return (
                <div
                  key={p.id}
                  className={`surface flex flex-col gap-1 p-3 transition-all ${
                    on ? "border-gold bg-gold/5" : ""
                  }`}
                >
                  <span className="flex items-center gap-2 text-xs font-bold">
                    <Icon id={p.id} className={`h-5 w-5 ${on ? "text-gold" : "text-gold-soft"}`} />
                    <span className="truncate">{p.label}</span>
                  </span>
                  <span className={`text-[11px] tabular-nums ${on ? "text-gold" : "text-muted-foreground"}`}>
                    {Math.round(p.angle)}°{p.km != null ? ` · ${p.km} كم` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
