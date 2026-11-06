import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Ban, Clock, ShieldCheck, Trash2, UserX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/community";
import { deleteUserAccount } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "لوحة إدارة المجتمع — أمتي" },
      { name: "description", content: "مراجعة بلاغات أعضاء مجتمع أمّتي واتخاذ إجراءات المنع أو حذف الحساب." },
      { property: "og:title", content: "لوحة إدارة المجتمع — أمتي" },
      { property: "og:description", content: "إدارة البلاغات والمنع وحذف الحسابات." },
    ],
  }),
  component: AdminPage,
});

type Report = {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  post_id: string | null;
  reason: string;
  status: string;
  created_at: string;
};

function AdminPage() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const removeAccount = useServerFn(deleteUserAccount);

  const { data: reports } = useQuery({
    queryKey: ["reports"],
    queryFn: async (): Promise<Report[]> => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["reports"] });
    void qc.invalidateQueries({ queryKey: ["feed"] });
  };

  const setStatus = async (id: string, status: string) => {
    await supabase.from("reports").update({ status }).eq("id", id);
    refresh();
  };

  const restrict = async (userId: string, days: number | null, permanent: boolean, reportId: string) => {
    const bannedUntil = days ? new Date(Date.now() + days * 86400000).toISOString() : null;
    const { error } = await supabase
      .from("user_restrictions")
      .upsert({ user_id: userId, banned_until: bannedUntil, permanent, reason: "قرار إداري" });
    if (error) {
      toast.error("تعذّر تطبيق المنع");
      return;
    }
    await setStatus(reportId, "resolved");
    toast.success(permanent ? "تم منع المستخدم من النشر نهائيًا" : `تم منع المستخدم ${days} يومًا`);
  };

  const lift = async (userId: string) => {
    await supabase.from("user_restrictions").delete().eq("user_id", userId);
    toast.success("تم رفع المنع");
    refresh();
  };

  const deleteAccount = async (userId: string, reportId: string) => {
    try {
      await removeAccount({ data: { userId } });
      await setStatus(reportId, "resolved");
      toast.success("تم حذف الحساب نهائيًا");
    } catch {
      toast.error("تعذّر حذف الحساب");
    }
  };

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-gold" />
        <h1 className="mt-4 text-2xl font-bold">هذه الصفحة للإدارة فقط</h1>
        <Link to="/community" className="mt-4 inline-block text-sm text-gold">
          العودة للمجتمع
        </Link>
      </div>
    );
  }

  const pending = (reports ?? []).filter((r) => r.status === "pending");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="flex items-center gap-2 text-3xl font-bold gold-gradient-text">
        <ShieldCheck className="h-7 w-7 text-gold" /> لوحة الإدارة
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        لديك {pending.length} بلاغًا بانتظار المراجعة من إجمالي {reports?.length ?? 0}.
      </p>

      <div className="mt-6 space-y-4">
        {reports?.map((r) => (
          <div key={r.id} className="surface p-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-bold">
                <AlertTriangle className="h-4 w-4 text-gold" /> بلاغ
              </span>
              <span
                className={`rounded-lg px-2 py-1 text-xs ${
                  r.status === "pending" ? "bg-secondary text-gold" : "bg-muted text-muted-foreground"
                }`}
              >
                {r.status === "pending" ? "قيد المراجعة" : r.status === "resolved" ? "تمت المعالجة" : "مرفوض"}
              </span>
            </div>
            <p className="mt-2 text-sm leading-7">{r.reason}</p>
            <p className="mt-1 text-xs text-muted-foreground">المستخدم المُبلَّغ عنه: {r.reported_user_id}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => restrict(r.reported_user_id, 3, false, r.id)}
                className="inline-flex items-center gap-1 rounded-xl bg-secondary px-3 py-1.5 text-xs"
              >
                <Clock className="h-3.5 w-3.5" /> منع ٣ أيام
              </button>
              <button
                onClick={() => restrict(r.reported_user_id, 30, false, r.id)}
                className="inline-flex items-center gap-1 rounded-xl bg-secondary px-3 py-1.5 text-xs"
              >
                <Clock className="h-3.5 w-3.5" /> منع شهر
              </button>
              <button
                onClick={() => restrict(r.reported_user_id, null, true, r.id)}
                className="inline-flex items-center gap-1 rounded-xl bg-secondary px-3 py-1.5 text-xs"
              >
                <Ban className="h-3.5 w-3.5" /> منع النشر نهائيًا
              </button>
              <button
                onClick={() => lift(r.reported_user_id)}
                className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs"
              >
                رفع المنع
              </button>
              {r.post_id && (
                <button
                  onClick={async () => {
                    await supabase.from("posts").delete().eq("id", r.post_id!);
                    await setStatus(r.id, "resolved");
                    toast.success("تم حذف المنشور");
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs"
                >
                  <Trash2 className="h-3.5 w-3.5" /> حذف المنشور
                </button>
              )}
              <button
                onClick={() => deleteAccount(r.reported_user_id, r.id)}
                className="inline-flex items-center gap-1 rounded-xl border border-destructive/60 px-3 py-1.5 text-xs text-destructive"
              >
                <UserX className="h-3.5 w-3.5" /> حذف الحساب
              </button>
              <button
                onClick={() => setStatus(r.id, "dismissed")}
                className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs"
              >
                تجاهل
              </button>
            </div>
          </div>
        ))}
        {reports?.length === 0 && <p className="text-sm text-muted-foreground">لا توجد بلاغات.</p>}
      </div>
    </div>
  );
}
