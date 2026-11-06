import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type SavedKind = "ayah" | "surah" | "hadith" | "zikr" | "tasbih" | "ward";

export type SavedItem = {
  kind: SavedKind;
  ref: string;
  label: string;
  meta: Record<string, unknown>;
  created_at: string;
};

const KEY = "emty-saved";
const LAST_KEY = "emty-last";

export type LastVisited = {
  quran?: { surah: number; ayah: number; label: string };
  azkar?: { category: string; index: number; label: string };
  tasbih?: { phrase: string; count: number };
  hadith?: { number: number; book: string };
};

const readLocal = (): SavedItem[] => {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as SavedItem[];
  } catch {
    return [];
  }
};

export function readLast(): LastVisited {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LAST_KEY) ?? "{}") as LastVisited;
  } catch {
    return {};
  }
}

export function writeLast(patch: Partial<LastVisited>) {
  if (typeof window === "undefined") return;
  const next = { ...readLast(), ...patch };
  localStorage.setItem(LAST_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("emty-last-changed"));
}

export function useLastVisited() {
  const [last, setLast] = useState<LastVisited>({});
  useEffect(() => {
    const sync = () => setLast(readLast());
    sync();
    window.addEventListener("emty-last-changed", sync);
    return () => window.removeEventListener("emty-last-changed", sync);
  }, []);
  return last;
}

export function useSaved() {
  const { user } = useAuth();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(readLocal());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("saved_items")
      .select("kind, ref, label, meta, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        const remote = data.map((d) => ({
          kind: d.kind as SavedKind,
          ref: d.ref,
          label: d.label,
          meta: (d.meta ?? {}) as Record<string, unknown>,
          created_at: d.created_at,
        }));
        setItems((local) => {
          const merged = [...remote];
          for (const l of local) {
            if (!merged.some((m) => m.kind === l.kind && m.ref === l.ref)) merged.push(l);
          }
          localStorage.setItem(KEY, JSON.stringify(merged));
          return merged;
        });
      });
  }, [user]);

  const persist = useCallback((next: SavedItem[]) => {
    setItems(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  }, []);

  const isSaved = useCallback(
    (kind: SavedKind, ref: string) => items.some((i) => i.kind === kind && i.ref === ref),
    [items],
  );

  const toggle = useCallback(
    (kind: SavedKind, ref: string, label: string, meta: Record<string, unknown> = {}) => {
      const exists = items.some((i) => i.kind === kind && i.ref === ref);
      if (exists) {
        persist(items.filter((i) => !(i.kind === kind && i.ref === ref)));
        if (user) void supabase.from("saved_items").delete().eq("kind", kind).eq("ref", ref);
        return false;
      }
      persist([{ kind, ref, label, meta, created_at: new Date().toISOString() }, ...items]);
      if (user)
        void supabase
          .from("saved_items")
          .upsert(
            { user_id: user.id, kind, ref, label, meta: meta as never },
            { onConflict: "user_id,kind,ref" },
          );
      return true;
    },
    [items, persist, user],
  );

  return { items, isSaved, toggle, ready };
}
