// Admin area root: login gate, then the tabbed control room.
import { useEffect, useState } from "react";
import type { AuthMe } from "@/types";
import { api } from "@/lib/client";
import { useToasts } from "@/components/ui";
import { Login } from "@/components/admin/Login";
import { AdminTabs } from "@/components/admin/AdminTabs";

export default function AdminApp() {
  const [me, setMe] = useState<AuthMe | null>(null);
  const { push, list: toasts } = useToasts();

  useEffect(() => {
    api<AuthMe>("/api/auth/me")
      .then(setMe)
      .catch(() => setMe({ authed: false, user: null, publicView: true }));
  }, []);

  if (!me) return <p className="p-8 text-center text-dim">Loading…</p>;
  if (!me.authed)
    return (
      <Login
        onDone={() => setMe({ authed: true, user: "admin", publicView: true })}
      />
    );
  return (
    <>
      <AdminTabs
        onLogout={async () => {
          await api("/api/auth/logout", { method: "POST", json: {} });
          setMe({ authed: false, user: null, publicView: true });
        }}
        push={push}
      />
      {toasts}
    </>
  );
}
