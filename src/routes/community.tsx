import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BadgeCheck, Film, Flag, HelpCircle, ImagePlus, Loader2, MessageCircle, PenLine, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  ADMIN_DISPLAY_NAME,
  fetchComments,
  fetchFeed,
  reactionKinds,
  timeAgo,
  useIsAdmin,
  type FeedPost,
  type PostKind,
} from "@/lib/community";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "مجتمع أمّتي — أسئلة ومنشورات وريلز دينية" },
      {
        name: "description",
        content:
          "شارك المجتمع أسئلتك الدينية ومنشوراتك وريلزاتك، تفاعل وعلّق، مع إدارة موثّقة وإمكانية الإبلاغ عن المخالفات.",
      },
      { property: "og:title", content: "مجتمع أمّتي" },
      { property: "og:description", content: "منشورات وأسئلة وريلز دينية وتفاعل بين الأعضاء." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CommunityPage,
});

const kinds: { key: PostKind; label: string; icon: typeof PenLine }[] = [
  { key: "post", label: "منشور", icon: PenLine },
  { key: "question", label: "سؤال ديني", icon: HelpCircle },
  { key: "reel", label: "ريلز", icon: Film },
];

function CommunityPage() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const { data: posts, isLoading } = useQuery({ queryKey: ["feed"], queryFn: fetchFeed });

  const [kind, setKind] = useState<PostKind>("post");
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [disableComments, setDisableComments] = useState(false);
  const [asAdmin, setAsAdmin] = useState(false);

  const uploadMedia = async (file: File) => {
    if (!user) {
      toast.error("سجّل الدخول أولًا لرفع الملفات");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("الحد الأقصى للملف 50 ميجابايت");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("community-media").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      const { data, error: signErr } = await supabase.storage
        .from("community-media")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (signErr || !data) throw signErr ?? new Error("sign failed");
      setMediaUrl(data.signedUrl);
      if (file.type.startsWith("video")) setKind("reel");
      toast.success("تم رفع الملف");
    } catch {
      toast.error("تعذّر رفع الملف، حاول مرة أخرى");
    } finally {
      setUploading(false);
    }
  };


  const publish = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("سجّل الدخول أولًا للنشر");
      if (content.trim().length < 2) throw new Error("اكتب محتوى المنشور");
      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        kind,
        content: content.trim(),
        media_url: mediaUrl.trim() || null,
        comments_disabled: disableComments,
        as_admin: isAdmin && asAdmin,
      });
      if (error) throw new Error("تعذّر النشر — قد يكون حسابك ممنوعًا من النشر");
    },
    onSuccess: () => {
      setContent("");
      setMediaUrl("");
      toast.success("تم النشر");
      void qc.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-bold gold-gradient-text">مجتمع أمّتي</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        اسأل، انشر، وشارك الريلزات الدينية — والتزم بأدب الحوار.
      </p>

      {isAdmin && (
        <Link
          to="/admin"
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-gold px-4 py-2 text-sm text-gold"
        >
          <BadgeCheck className="h-4 w-4" /> لوحة الإدارة والبلاغات
        </Link>
      )}

      {/* Composer */}
      <div className="surface mt-5 p-4">
        {user ? (
          <>
            <div className="flex flex-wrap gap-2">
              {kinds.map((k) => (
                <button
                  key={k.key}
                  onClick={() => setKind(k.key)}
                  className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs ${
                    kind === k.key ? "border-gold bg-secondary text-gold" : "border-border"
                  }`}
                >
                  <k.icon className="h-3.5 w-3.5" /> {k.label}
                </button>
              ))}
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              maxLength={5000}
              placeholder={kind === "question" ? "اكتب سؤالك الديني..." : "بمَ تفكّر؟"}
              className="mt-3 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-gold"
            />
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-gold/60 px-3 py-2 text-xs text-gold">
                  <ImagePlus className="h-3.5 w-3.5" />
                  {uploading ? "جارٍ الرفع..." : "رفع صورة أو فيديو من جهازك"}
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadMedia(file);
                      e.target.value = "";
                    }}
                  />
                </label>
                {mediaUrl && (
                  <button
                    onClick={() => setMediaUrl("")}
                    className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> إزالة المرفق
                  </button>
                )}
              </div>
              {kind === "reel" && (
                <input
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="أو ألصق رابط الفيديو (mp4 أو يوتيوب)"
                  className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-gold"
                />
              )}
              {mediaUrl && !mediaUrl.includes("youtu") && (
                <div className="overflow-hidden rounded-xl border border-border">
                  {/\.(mp4|webm|mov|m4v)(\?|$)/i.test(mediaUrl) ? (
                    <video src={mediaUrl} controls className="max-h-64 w-full" />
                  ) : (
                    <img src={mediaUrl} alt="معاينة المرفق" className="max-h-64 w-full object-cover" />
                  )}
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={disableComments}
                  onChange={(e) => setDisableComments(e.target.checked)}
                  className="accent-[var(--gold)]"
                />
                منع التعليقات على منشوري
              </label>
              {isAdmin && (
                <label className="flex items-center gap-2 text-xs text-gold">
                  <input type="checkbox" checked={asAdmin} onChange={(e) => setAsAdmin(e.target.checked)} />
                  النشر باسم {ADMIN_DISPLAY_NAME}
                </label>
              )}
              <button
                onClick={() => publish.mutate()}
                disabled={publish.isPending}
                className="inline-flex items-center gap-2 rounded-xl hero-gradient px-5 py-2 text-sm font-semibold text-gold"
              >
                {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} نشر
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            <Link to="/auth" className="text-gold">
              سجّل الدخول
            </Link>{" "}
            للنشر والتعليق — التصفّح متاح للجميع.
          </p>
        )}
      </div>

      {isLoading && <p className="mt-6 text-center text-sm text-muted-foreground">جارٍ تحميل المنشورات...</p>}

      <div className="mt-6 space-y-4">
        {posts?.map((p) => (
          <PostCard key={p.id} post={p} isAdmin={isAdmin} />
        ))}
        {posts?.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">لا توجد منشورات بعد — كن أول من يشارك.</p>
        )}
      </div>
    </div>
  );
}

function PostCard({ post, isAdmin }: { post: FeedPost; isAdmin: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openComments, setOpenComments] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [text, setText] = useState("");

  const { data: comments } = useQuery({
    queryKey: ["comments", post.id],
    queryFn: () => fetchComments(post.id),
    enabled: openComments,
  });

  const myReaction = post.reactions.find((r) => r.user_id === user?.id)?.kind;

  const react = async (kindKey: string) => {
    if (!user) {
      toast.error("سجّل الدخول للتفاعل");
      return;
    }
    if (myReaction === kindKey) {
      await supabase.from("reactions").delete().eq("post_id", post.id).eq("user_id", user.id);
    } else {
      await supabase.from("reactions").upsert({ post_id: post.id, user_id: user.id, kind: kindKey });
    }
    void qc.invalidateQueries({ queryKey: ["feed"] });
  };

  const addComment = async () => {
    if (!user) {
      toast.error("سجّل الدخول للتعليق");
      return;
    }
    if (text.trim().length < 1) return;
    const { error } = await supabase
      .from("comments")
      .insert({ post_id: post.id, user_id: user.id, content: text.trim() });
    if (error) {
      toast.error("تعذّر التعليق — التعليقات قد تكون معطّلة أو حسابك ممنوع");
      return;
    }
    setText("");
    void qc.invalidateQueries({ queryKey: ["comments", post.id] });
    void qc.invalidateQueries({ queryKey: ["feed"] });
  };

  const removePost = async () => {
    await supabase.from("posts").delete().eq("id", post.id);
    toast.success("تم حذف المنشور");
    void qc.invalidateQueries({ queryKey: ["feed"] });
  };

  const sendReport = async () => {
    if (!user) {
      toast.error("سجّل الدخول للإبلاغ");
      return;
    }
    if (reason.trim().length < 3) {
      toast.error("اكتب سبب البلاغ");
      return;
    }
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      reported_user_id: post.user_id,
      post_id: post.id,
      reason: reason.trim(),
    });
    if (error) {
      toast.error("تعذّر إرسال البلاغ");
      return;
    }
    setReporting(false);
    setReason("");
    toast.success("وصل بلاغك للإدارة");
  };

  const counts = reactionKinds
    .map((r) => ({ ...r, n: post.reactions.filter((x) => x.kind === r.key).length }))
    .filter((r) => r.n > 0);

  return (
    <article className="surface animate-fade-up p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full hero-gradient text-sm font-bold text-gold">
            {post.author.slice(0, 1)}
          </span>
          <div>
            <p className="flex items-center gap-1 text-sm font-bold">
              {post.author}
              {post.as_admin && <BadgeCheck className="h-4 w-4 text-gold" aria-label="حساب موثّق" />}
            </p>
            <p className="text-xs text-muted-foreground">
              {timeAgo(post.created_at)} ·{" "}
              {post.kind === "question" ? "سؤال ديني" : post.kind === "reel" ? "ريلز" : "منشور"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {(isAdmin || user?.id === post.user_id) && (
            <button onClick={removePost} className="rounded-lg p-2 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          {user?.id !== post.user_id && (
            <button
              onClick={() => setReporting((v) => !v)}
              className="rounded-lg p-2 text-muted-foreground hover:text-gold"
              aria-label="إبلاغ"
            >
              <Flag className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {reporting && (
        <div className="mt-3 rounded-xl border border-border p-3">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="سبب الإبلاغ عن هذا المستخدم/المنشور"
            className="w-full rounded-lg border border-border bg-background p-2 text-sm outline-none focus:border-gold"
          />
          <button onClick={sendReport} className="mt-2 rounded-lg bg-secondary px-4 py-1.5 text-xs text-gold">
            إرسال البلاغ للإدارة
          </button>
        </div>
      )}

      <p className="mt-3 whitespace-pre-wrap text-[15px] leading-8">{post.content}</p>

      {post.media_url && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-border">
          {post.media_url.includes("youtu") ? (
            <iframe
              className="aspect-video w-full"
              src={post.media_url.replace("watch?v=", "embed/").replace("youtu.be/", "www.youtube.com/embed/")}
              title="ريلز"
              allowFullScreen
            />
          ) : /\.(mp4|webm|mov|m4v)(\?|$)/i.test(post.media_url) || post.kind === "reel" ? (
            <video src={post.media_url} controls playsInline className="w-full" />
          ) : (
            <img src={post.media_url} alt="مرفق المنشور" loading="lazy" className="w-full object-cover" />
          )}
        </div>
      )}


      {counts.length > 0 && (
        <div className="mt-3 flex gap-2 text-xs text-muted-foreground">
          {counts.map((r) => (
            <span key={r.key}>
              {r.emoji} {r.n}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-border pt-3">
        {reactionKinds.map((r) => (
          <button
            key={r.key}
            onClick={() => react(r.key)}
            className={`rounded-xl px-3 py-1.5 text-sm transition-all hover:bg-secondary ${
              myReaction === r.key ? "bg-secondary text-gold" : ""
            }`}
            title={r.label}
          >
            {r.emoji}
          </button>
        ))}
        <button
          onClick={() => setOpenComments((v) => !v)}
          className="mr-auto inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
        >
          <MessageCircle className="h-4 w-4" /> {post.comments_count} تعليق
        </button>
      </div>

      {openComments && (
        <div className="mt-3 space-y-2">
          {comments?.map((c) => (
            <div key={c.id} className="rounded-xl bg-secondary/60 p-3">
              <p className="text-xs font-bold">
                {c.author} <span className="font-normal text-muted-foreground">· {timeAgo(c.created_at)}</span>
              </p>
              <p className="mt-1 text-sm leading-7">{c.content}</p>
            </div>
          ))}
          {post.comments_disabled ? (
            <p className="rounded-xl border border-border p-3 text-xs text-muted-foreground">
              صاحب المنشور أوقف التعليقات.
            </p>
          ) : (
            <div className="flex gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addComment()}
                placeholder="اكتب تعليقًا..."
                className="flex-1 rounded-xl border border-border bg-background p-2.5 text-sm outline-none focus:border-gold"
              />
              <button onClick={addComment} className="rounded-xl bg-secondary px-4 text-sm text-gold">
                <Send className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
