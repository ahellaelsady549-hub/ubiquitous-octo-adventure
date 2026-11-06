import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, BellRing, Clock, Heart, ScrollText, Sparkles, Volume2 } from "lucide-react";
import { toast } from "sonner";
import {
  defaultPrefs,
  loadPrefs,
  requestPermission,
  savePrefs,
  type NotificationPrefs,
} from "@/lib/notifications";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "إعدادات الإشعارات — أمتي" },
      {
        name: "description",
        content:
          "تحكّم في إشعارات الأذكار والتذكير قبل الصلاة والصلاة على النبي ﷺ وحديث اليوم، وغيّر توقيتاتها كما تحب.",
      },
      { property: "og:title", content: "إعدادات الإشعارات — أمتي" },
      { property: "og:description", content: "خصّص إشعارات موقع أمتي وتوقيتاتها حسب رغبتك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function Toggle({
  label,
  desc,
  icon: Icon,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  icon: typeof Bell;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="surface flex items-center justify-between gap-4 p-4">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
        <div>
          <p className="font-display text-base">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <button
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          value ? "bg-gold" : "bg-secondary"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-background transition-all ${
            value ? "right-1" : "right-6"
          }`}
        />
      </button>
    </div>
  );
}

function NumberRow({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="surface flex items-center justify-between gap-4 p-4">
      <div>
        <p className="font-display text-base">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
        className="w-24 rounded-xl border border-border bg-card px-3 py-2 text-center text-sm"
      />
    </div>
  );
}

function SettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(defaultPrefs);
  const [permission, setPermission] = useState<string>("default");

  useEffect(() => {
    setPrefs(loadPrefs());
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }, []);

  const update = (patch: Partial<NotificationPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePrefs(next);
  };

  const enable = async () => {
    const ok = await requestPermission();
    setPermission(typeof Notification !== "undefined" ? Notification.permission : "default");
    toast[ok ? "success" : "error"](ok ? "تم تفعيل الإشعارات" : "لم يتم السماح بالإشعارات");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="flex items-center gap-2 text-3xl font-bold gold-gradient-text">
        <BellRing className="h-7 w-7 text-gold" /> إعدادات الإشعارات
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        فعّل ما تحب من التذكيرات وغيّر توقيتاتها، وتُحفَظ اختياراتك على جهازك فورًا.
      </p>

      {permission !== "granted" && (
        <button
          onClick={enable}
          className="mt-5 inline-flex items-center gap-2 rounded-xl hero-gradient px-5 py-3 text-sm font-semibold text-gold"
        >
          <Bell className="h-4 w-4" /> تفعيل الإشعارات على هذا الجهاز
        </button>
      )}

      <div className="mt-6 grid gap-3">
        <Toggle
          label="التذكير قبل الصلاة والأذان"
          desc="تنبيه قبل الأذان بالمدة التي تحددها، ثم الأذان وعدّاد الإقامة."
          icon={Clock}
          value={prefs.prayers}
          onChange={(v) => update({ prayers: v })}
        />
        <Toggle
          label="أذكار الصباح والمساء"
          desc="تذكير بعد الفجر وبعد العصر بالمدة التي تحددها."
          icon={Heart}
          value={prefs.azkar}
          onChange={(v) => update({ azkar: v })}
        />
        <Toggle
          label="الصلاة على النبي ﷺ"
          desc="تذكيرات في أوقات عشوائية خلال اليوم بصوت مسجّل."
          icon={Sparkles}
          value={prefs.salawat}
          onChange={(v) => update({ salawat: v })}
        />
        <Toggle
          label="حديث اليوم ونصيحة اليوم"
          desc="حديث صحيح كل صباح ونصيحة كل مساء."
          icon={ScrollText}
          value={prefs.hadith}
          onChange={(v) => update({ hadith: v })}
        />
        <Toggle
          label="صوت الأذان"
          desc="تشغيل الأذان كاملًا عند دخول الوقت (وأذان الفجر بصيغته الخاصة)."
          icon={Volume2}
          value={prefs.adhanSound}
          onChange={(v) => update({ adhanSound: v })}
        />
        <Toggle
          label="نغمة التنبيه"
          desc="نغمة قصيرة تُشغَّل مع كل إشعار."
          icon={Bell}
          value={prefs.tone}
          onChange={(v) => update({ tone: v })}
        />
      </div>

      <h2 className="mt-8 font-display text-xl text-gold">التوقيتات</h2>
      <div className="mt-3 grid gap-3">
        <NumberRow
          label="التذكير قبل الأذان"
          hint="بالدقائق قبل دخول وقت الصلاة"
          value={prefs.beforeMinutes}
          min={1}
          max={60}
          onChange={(v) => update({ beforeMinutes: v })}
        />
        <NumberRow
          label="أذكار الصباح بعد الفجر"
          hint="بالدقائق بعد أذان الفجر"
          value={prefs.morningOffset}
          min={0}
          max={180}
          onChange={(v) => update({ morningOffset: v })}
        />
        <NumberRow
          label="أذكار المساء بعد العصر"
          hint="بالدقائق بعد أذان العصر"
          value={prefs.eveningOffset}
          min={0}
          max={180}
          onChange={(v) => update({ eveningOffset: v })}
        />
        <NumberRow
          label="عدد مرات الصلاة على النبي ﷺ"
          hint="عدد التذكيرات اليومية في أوقات عشوائية"
          value={prefs.salawatCount}
          min={1}
          max={30}
          onChange={(v) => update({ salawatCount: v })}
        />
      </div>
    </div>
  );
}
