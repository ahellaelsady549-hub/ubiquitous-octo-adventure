export type Reciter = {
  id: string;
  name: string;
  /** مجلد everyayah بجودة عالية */
  folder: string;
  /** مجلد بجودة أخف للاتصال الضعيف */
  folderLow?: string;
  /** سيرفر تحميل السورة كاملة */
  download?: string;
};

export const reciters: Reciter[] = [
  {
    id: "minshawi",
    name: "الشيخ محمد صديق المنشاوي (مرتّل)",
    folder: "Minshawy_Murattal_128kbps",
    download: "https://server10.mp3quran.net/minsh/",
  },
  {
    id: "minshawi-mujawwad",
    name: "الشيخ المنشاوي (المصحف المجوّد)",
    folder: "Minshawy_Mujawwad_192kbps",
    folderLow: "Minshawy_Mujawwad_64kbps",
    download: "https://server10.mp3quran.net/minsh/Almusshaf-Al-Mojawwad/",
  },
  {
    id: "husary",
    name: "الشيخ محمود خليل الحصري",
    folder: "Husary_128kbps",
    folderLow: "Husary_64kbps",
    download: "https://server13.mp3quran.net/husr/",
  },
  {
    id: "banna",
    name: "الشيخ محمود علي البنا",
    folder: "Mahmoud_Ali_Al_Banna_32kbps",
    download: "https://server8.mp3quran.net/bna/",
  },
  {
    id: "abdulbasit",
    name: "الشيخ عبد الباسط عبد الصمد",
    folder: "Abdul_Basit_Murattal_192kbps",
    folderLow: "Abdul_Basit_Murattal_64kbps",
    download: "https://server7.mp3quran.net/basit/",
  },
  {
    id: "afasy",
    name: "الشيخ مشاري راشد العفاسي",
    folder: "Alafasy_128kbps",
    folderLow: "Alafasy_64kbps",
    download: "https://server8.mp3quran.net/afs/",
  },
  {
    id: "yasser",
    name: "الشيخ ياسر الدوسري",
    folder: "Yasser_Ad-Dussary_128kbps",
    download: "https://server11.mp3quran.net/yasser/",
  },
];

export type Quality = "high" | "low";

/** مجلد التلاوة حسب جودة الاستماع المختارة */
export function reciterFolder(folder: string, quality: Quality): string {
  const r = reciters.find((x) => x.folder === folder);
  if (!r) return folder;
  return quality === "low" ? (r.folderLow ?? r.folder) : r.folder;
}

/** رابط تحميل السورة كاملة بصوت القارئ */
export function surahDownloadUrl(reciterFolderId: string, surah: number): string | null {
  const r = reciters.find((x) => x.folder === reciterFolderId);
  if (!r?.download) return null;
  return `${r.download}${String(surah).padStart(3, "0")}.mp3`;
}

export type SurahMeta = {
  number: number;
  name: string;
  englishName: string;
  numberOfAyahs: number;
  revelationType: string;
};

export type Ayah = { number: number; numberInSurah: number; text: string; page?: number; juz?: number };

export async function fetchSurahList(): Promise<SurahMeta[]> {
  const res = await fetch("https://api.alquran.cloud/v1/surah");
  if (!res.ok) throw new Error("تعذّر تحميل قائمة السور");
  const json = await res.json();
  return json.data as SurahMeta[];
}

export async function fetchSurah(n: number): Promise<{ meta: SurahMeta; ayahs: Ayah[] }> {
  const res = await fetch(`https://api.alquran.cloud/v1/surah/${n}/quran-uthmani`);
  if (!res.ok) throw new Error("تعذّر تحميل السورة");
  const json = await res.json();
  const d = json.data;
  return {
    meta: {
      number: d.number,
      name: d.name,
      englishName: d.englishName,
      numberOfAyahs: d.numberOfAyahs,
      revelationType: d.revelationType,
    },
    ayahs: d.ayahs.map((a: { number: number; numberInSurah: number; text: string; page: number; juz: number }) => ({
      number: a.number,
      numberInSurah: a.numberInSurah,
      text: a.text,
      page: a.page,
      juz: a.juz,
    })),
  };
}

/* ------------------------- التفسير الميسّر ------------------------- */

export async function fetchTafsir(surah: number): Promise<Record<number, string>> {
  const res = await fetch(`https://api.alquran.cloud/v1/surah/${surah}/ar.muyassar`);
  if (!res.ok) throw new Error("تعذّر تحميل التفسير");
  const json = await res.json();
  const out: Record<number, string> = {};
  for (const a of json.data.ayahs as { numberInSurah: number; text: string }[]) out[a.numberInSurah] = a.text;
  return out;
}

/* ------------------------- الصفحات والأجزاء والأحزاب ------------------------- */

export type PageAyah = {
  number: number;
  numberInSurah: number;
  text: string;
  surahNumber: number;
  surahName: string;
  juz?: number | undefined;
};

type ApiPageAyah = {
  number: number;
  numberInSurah: number;
  text: string;
  juz?: number;
  surah: { number: number; name: string };
};

async function fetchRange(path: string, label: string): Promise<PageAyah[]> {
  const res = await fetch(`https://api.alquran.cloud/v1/${path}/quran-uthmani`);
  if (!res.ok) throw new Error(`تعذّر تحميل ${label}`);
  const json = await res.json();
  return (json.data.ayahs as ApiPageAyah[]).map((a) => ({
    number: a.number,
    numberInSurah: a.numberInSurah,
    text: a.text,
    surahNumber: a.surah.number,
    surahName: a.surah.name,
    juz: a.juz,
  }));
}

export const fetchPage = (n: number) => fetchRange(`page/${n}`, "الصفحة");
export const fetchJuz = (n: number) => fetchRange(`juz/${n}`, "الجزء");
/** الحزب مكوَّن من 4 أرباع في تقسيم hizbQuarter (1..240) */
export async function fetchHizb(n: number): Promise<PageAyah[]> {
  const quarters = [4 * n - 3, 4 * n - 2, 4 * n - 1, 4 * n];
  const parts = await Promise.all(quarters.map((q) => fetchRange(`hizbQuarter/${q}`, "الحزب")));
  return parts.flat();
}

export const TOTAL_PAGES = 604;
export const TOTAL_JUZ = 30;
export const TOTAL_HIZB = 60;

/* ------------------------- البحث عن آية ------------------------- */

export type SearchHit = {
  key: string;
  text: string;
  surahNumber: number;
  surahName: string;
  numberInSurah: number;
};

/** تجريد التشكيل وتوحيد الهمزات للبحث المرن */
export function normalizeArabic(s: string) {
  return s
    .replace(/[\u064B-\u0652\u0670\u0640\u06D6-\u06ED]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

type IndexEntry = SearchHit & { norm: string };
let quranIndex: IndexEntry[] | null = null;

/** يُحمَّل نص المصحف كاملًا مرة واحدة ثم يُبحث فيه محليًا */
export async function loadQuranIndex(): Promise<IndexEntry[]> {
  if (quranIndex) return quranIndex;
  const res = await fetch("https://api.alquran.cloud/v1/quran/quran-uthmani");
  if (!res.ok) throw new Error("تعذّر تحميل نص المصحف للبحث");
  const json = await res.json();
  const out: IndexEntry[] = [];
  for (const s of json.data.surahs as {
    number: number;
    name: string;
    ayahs: { numberInSurah: number; text: string }[];
  }[]) {
    for (const a of s.ayahs) {
      out.push({
        key: `${s.number}-${a.numberInSurah}`,
        text: a.text,
        surahNumber: s.number,
        surahName: s.name,
        numberInSurah: a.numberInSurah,
        norm: normalizeArabic(a.text),
      });
    }
  }
  quranIndex = out;
  return out;
}

export async function searchAyahs(q: string): Promise<SearchHit[]> {
  const term = normalizeArabic(q);
  if (term.length < 2) return [];
  const index = await loadQuranIndex();
  return index.filter((a) => a.norm.includes(term)).slice(0, 80);
}

const pad = (n: number, len = 3) => String(n).padStart(len, "0");

export function ayahAudioUrl(folder: string, surah: number, ayah: number) {
  return `https://everyayah.com/data/${folder}/${pad(surah)}${pad(ayah)}.mp3`;
}

/* ---------------- الرقية الشرعية بصوت الشيخ المنشاوي ---------------- */

export type RuqyahSection = {
  id: string;
  title: string;
  surah: number;
  from: number;
  to: number;
};

export const ruqyahReciterFolder = "Minshawy_Murattal_128kbps";

export const ruqyahSections: RuqyahSection[] = [
  { id: "fatiha", title: "سورة الفاتحة", surah: 1, from: 1, to: 7 },
  { id: "baqara-1-5", title: "البقرة ١ - ٥", surah: 2, from: 1, to: 5 },
  { id: "baqara-102", title: "البقرة ١٠٢", surah: 2, from: 102, to: 102 },
  { id: "baqara-163-164", title: "البقرة ١٦٣ - ١٦٤", surah: 2, from: 163, to: 164 },
  { id: "kursi", title: "آية الكرسي (البقرة ٢٥٥)", surah: 2, from: 255, to: 255 },
  { id: "baqara-285-286", title: "خواتيم البقرة ٢٨٥ - ٢٨٦", surah: 2, from: 285, to: 286 },
  { id: "imran-18-19", title: "آل عمران ١٨ - ١٩", surah: 3, from: 18, to: 19 },
  { id: "araf-54-56", title: "الأعراف ٥٤ - ٥٦", surah: 7, from: 54, to: 56 },
  { id: "araf-117-122", title: "الأعراف ١١٧ - ١٢٢", surah: 7, from: 117, to: 122 },
  { id: "yunus-81-82", title: "يونس ٨١ - ٨٢", surah: 10, from: 81, to: 82 },
  { id: "taha-69", title: "طه ٦٩", surah: 20, from: 69, to: 69 },
  { id: "muminun-115-118", title: "المؤمنون ١١٥ - ١١٨", surah: 23, from: 115, to: 118 },
  { id: "saffat-1-10", title: "الصافات ١ - ١٠", surah: 37, from: 1, to: 10 },
  { id: "ahqaf-29-32", title: "الأحقاف ٢٩ - ٣٢", surah: 46, from: 29, to: 32 },
  { id: "rahman-33-36", title: "الرحمن ٣٣ - ٣٦", surah: 55, from: 33, to: 36 },
  { id: "hashr-21-24", title: "خواتيم الحشر ٢١ - ٢٤", surah: 59, from: 21, to: 24 },
  { id: "jinn-1-9", title: "الجن ١ - ٩", surah: 72, from: 1, to: 9 },
  { id: "ikhlas", title: "سورة الإخلاص", surah: 112, from: 1, to: 4 },
  { id: "falaq", title: "سورة الفلق", surah: 113, from: 1, to: 5 },
  { id: "nas", title: "سورة الناس", surah: 114, from: 1, to: 6 },
];

export function ruqyahPlaylist(): { surah: number; ayah: number }[] {
  return ruqyahSections.flatMap((s) => {
    const out: { surah: number; ayah: number }[] = [];
    for (let a = s.from; a <= s.to; a++) out.push({ surah: s.surah, ayah: a });
    return out;
  });
}
