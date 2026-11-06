import { useState } from "react";

const MEMORIAL_IMG = "/media/hajj-memorial.jpg";

type Side = "left" | "right" | null;

/** لوحة الصدقة الجارية — عن الحاج مصطفى علي والحاج علي علي رحمهما الله */
export function Memorial() {
  const [hover, setHover] = useState<Side>(null);

  const dua =
    hover === "left"
      ? "اللهم اغفر للحاج مصطفى وارحمه وأسكنه الفردوس الأعلى"
      : hover === "right"
        ? "اللهم اغفر للحاج علي وارحمه وأسكنه الفردوس الأعلى يا رب"
        : null;

  return (
    <section
      aria-label="صدقة جارية"
      className="relative mt-10 overflow-hidden rounded-3xl border border-border bg-background"
    >
      <div className="relative w-full">
        {/* الصورة الأساسية مطفية */}
        <img
          src={MEMORIAL_IMG}
          alt="الحاج مصطفى علي والحاج علي علي رحمهما الله"
          className="block h-auto w-full object-contain brightness-[0.35] grayscale transition-all duration-700"
        />

        {/* الجهة اليسرى: الحاج مصطفى */}
        <img
          src={MEMORIAL_IMG}
          alt=""
          aria-hidden
          className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-700 ${
            hover === "left" ? "opacity-100" : "opacity-0"
          }`}
          style={{ clipPath: "inset(0 50% 0 0)" }}
        />
        {/* الجهة اليمنى: الحاج علي */}
        <img
          src={MEMORIAL_IMG}
          alt=""
          aria-hidden
          className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-700 ${
            hover === "right" ? "opacity-100" : "opacity-0"
          }`}
          style={{ clipPath: "inset(0 0 0 50%)" }}
        />

        {/* مناطق التفاعل */}
        <button
          type="button"
          aria-label="الحاج مصطفى علي"
          onMouseEnter={() => setHover("left")}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover("left")}
          onBlur={() => setHover(null)}
          onClick={() => setHover((v) => (v === "left" ? null : "left"))}
          className="absolute inset-y-0 left-0 w-1/2 cursor-pointer"
        />
        <button
          type="button"
          aria-label="الحاج علي علي"
          onMouseEnter={() => setHover("right")}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover("right")}
          onBlur={() => setHover(null)}
          onClick={() => setHover((v) => (v === "right" ? null : "right"))}
          className="absolute inset-y-0 right-0 w-1/2 cursor-pointer"
        />

        {/* النصوص */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/60 to-transparent p-5 text-center sm:p-8">
          <p className="text-xs tracking-widest text-gold-soft">هذا الموقع صدقة جارية</p>
          <p className="mt-1 font-display text-lg text-gold sm:text-2xl">
            عن الحاج مصطفى علي والحاج علي علي — رحمهما الله
          </p>
          <p
            className={`mx-auto mt-3 max-w-xl rounded-2xl border border-gold/40 bg-background/70 px-4 py-2 text-sm leading-7 text-gold transition-all duration-500 sm:text-base ${
              dua ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
            }`}
          >
            {dua ?? "‎"}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            مرّر على أحدهما ليُنير وتظهر الدعوة له
          </p>
        </div>
      </div>
    </section>
  );
}
