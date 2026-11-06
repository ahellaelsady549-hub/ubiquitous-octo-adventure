export type Hadith = { number: number; text: string; book: string };

type Edition = { key: string; label: string; slug: string };

const editions: Edition[] = [
  { key: "bukhari", label: "صحيح البخاري", slug: "ara-bukhari" },
  { key: "muslim", label: "صحيح مسلم", slug: "ara-muslim" },
  { key: "nawawi", label: "الأربعون النووية", slug: "ara-nawawi" },
];

const LIMIT_PER_BOOK: Record<string, number> = { bukhari: 1200, muslim: 1200, nawawi: 100 };

let cache: Hadith[] | null = null;

export async function fetchHadiths(): Promise<Hadith[]> {
  if (cache) return cache;
  const results = await Promise.all(
    editions.map(async (e) => {
      try {
        const res = await fetch(
          `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${e.slug}.min.json`,
        );
        if (!res.ok) return [];
        const json = (await res.json()) as {
          hadiths: { hadithnumber: number; text: string }[];
        };
        return json.hadiths.slice(0, LIMIT_PER_BOOK[e.key] ?? 500).map((h) => ({
          number: h.hadithnumber,
          text: h.text,
          book: e.label,
        }));
      } catch {
        return [];
      }
    }),
  );
  cache = results.flat();
  return cache;
}

export function hadithOfTheDay(list: Hadith[], date = new Date()): Hadith | null {
  if (!list.length) return null;
  const dayIndex = Math.floor(date.getTime() / 86400000);
  return list[dayIndex % list.length]!;
}
