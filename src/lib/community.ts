import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const ADMIN_DISPLAY_NAME = "ummah community admin";

export type PostKind = "post" | "question" | "reel";

export type FeedPost = {
  id: string;
  user_id: string;
  kind: PostKind;
  content: string;
  media_url: string | null;
  comments_disabled: boolean;
  as_admin: boolean;
  created_at: string;
  author: string;
  reactions: { kind: string; user_id: string }[];
  comments_count: number;
};

export const reactionKinds = [
  { key: "like", label: "إعجاب", emoji: "👍" },
  { key: "love", label: "أحببته", emoji: "❤️" },
  { key: "dua", label: "دعاء", emoji: "🤲" },
  { key: "mashallah", label: "ما شاء الله", emoji: "✨" },
  { key: "sad", label: "محزن", emoji: "😢" },
] as const;

export function useIsAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    void supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(Boolean(data)));
  }, [user]);
  return isAdmin;
}

export async function fetchFeed(): Promise<FeedPost[]> {
  const { data: posts, error } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const rows = posts ?? [];
  if (!rows.length) return [];

  const ids = rows.map((p) => p.id);
  const authorIds = [...new Set(rows.map((p) => p.user_id))];

  const [{ data: profiles }, { data: reactions }, { data: comments }] = await Promise.all([
    supabase.from("profiles").select("id, display_name").in("id", authorIds),
    supabase.from("reactions").select("post_id, kind, user_id").in("post_id", ids),
    supabase.from("comments").select("post_id").in("post_id", ids),
  ]);

  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.display_name ?? "عضو"]));

  return rows.map((p) => ({
    id: p.id,
    user_id: p.user_id,
    kind: p.kind as PostKind,
    content: p.content,
    media_url: p.media_url,
    comments_disabled: p.comments_disabled,
    as_admin: p.as_admin,
    created_at: p.created_at,
    author: p.as_admin ? ADMIN_DISPLAY_NAME : (nameOf.get(p.user_id) ?? "عضو"),
    reactions: (reactions ?? []).filter((r) => r.post_id === p.id).map((r) => ({ kind: r.kind, user_id: r.user_id })),
    comments_count: (comments ?? []).filter((c) => c.post_id === p.id).length,
  }));
}

export type FeedComment = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  author: string;
};

export async function fetchComments(postId: string): Promise<FeedComment[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  if (!rows.length) return [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", [...new Set(rows.map((r) => r.user_id))]);
  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.display_name ?? "عضو"]));
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    content: r.content,
    created_at: r.created_at,
    author: nameOf.get(r.user_id) ?? "عضو",
  }));
}

export function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "الآن";
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
  return `منذ ${Math.floor(diff / 86400)} يوم`;
}
