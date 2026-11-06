import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchTimings, type Timings } from "@/lib/prayer";

export type Coords = { lat: number; lon: number };

const KEY = "emty-coords";

export function useCoords() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    if (stored) {
      try {
        setCoords(JSON.parse(stored));
      } catch {
        /* ignore */
      }
    }
    if (!("geolocation" in navigator)) {
      setError("المتصفح لا يدعم تحديد الموقع");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        localStorage.setItem(KEY, JSON.stringify(next));
        setCoords(next);
        setError(null);
      },
      () => {
        if (!localStorage.getItem(KEY)) {
          setError("لم نتمكن من تحديد موقعك، سنستخدم توقيت مكة المكرمة");
          setCoords({ lat: 21.4225, lon: 39.8262 });
        }
      },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 60000 },
    );
  }, []);

  return { coords, error };
}

export function usePrayerTimings(coords: Coords | null) {
  return useQuery<Timings>({
    queryKey: ["timings", coords?.lat?.toFixed(2), coords?.lon?.toFixed(2)],
    queryFn: () => fetchTimings(coords!.lat, coords!.lon),
    enabled: !!coords,
    staleTime: 1000 * 60 * 30,
  });
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
