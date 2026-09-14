// Tab bar of the control room: servers, backups and system panels. The active
// tab is mirrored into the location hash (#backups, #system).
import { useState } from "react";
import type { ToastPush } from "@/components/ui";
import { Button, cn } from "@/components/ui";
import { ServersTab } from "@/components/admin/ServersTab";
import { BackupsTab } from "@/components/admin/BackupsTab";
import { SystemTab } from "@/components/admin/SystemTab";

type Tab = "servers" | "backups" | "system";

const ADMIN_TABS: Tab[] = ["servers", "backups", "system"];

function initialTab(): Tab {
  if (typeof location === "undefined") return "servers";
  if (location.hash === "#backups" || location.hash === "#copias")
    return "backups";
  if (location.hash === "#system") return "system";
  return "servers";
}

export function AdminTabs({
  onLogout,
  push,
}: {
  onLogout: () => void;
  push: ToastPush;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  const selectTab = (next: Tab) => {
    setTab(next);
    history.replaceState(
      null,
      "",
      next === "servers" ? location.pathname : `#${next}`,
    );
  };

  return (
    <>
      <section className="page-heading" aria-labelledby="admin-title">
        <div>
          <h1 id="admin-title">Control room</h1>
          <p>
            Manage server lifecycle, backups and host resources from one place.
          </p>
        </div>
        <Button variant="ghost" onClick={onLogout}>
          Sign out
        </Button>
      </section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-edge2">
        <div role="tablist" aria-label="Admin sections" className="flex gap-1">
          {ADMIN_TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`admin-${t}-tab`}
              aria-controls={`admin-${t}-panel`}
              aria-selected={tab === t}
              className={cn(
                "relative min-h-11 cursor-pointer border-0 bg-transparent px-4 font-sans text-sm font-semibold text-dim after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-transparent",
                tab === t ? "text-ink after:bg-ok" : "hover:text-ink",
              )}
              onClick={() => selectTab(t)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
                  return;
                event.preventDefault();
                const offset = event.key === "ArrowRight" ? 1 : -1;
                const next =
                  ADMIN_TABS[
                    (ADMIN_TABS.indexOf(t) + offset + ADMIN_TABS.length) %
                      ADMIN_TABS.length
                  ];
                selectTab(next);
                requestAnimationFrame(() =>
                  document.getElementById(`admin-${next}-tab`)?.focus(),
                );
              }}
            >
              {t === "servers"
                ? "Servers"
                : t === "backups"
                  ? "Backups"
                  : "System"}
            </button>
          ))}
        </div>
      </div>
      <div
        role="tabpanel"
        id={`admin-${tab}-panel`}
        aria-labelledby={`admin-${tab}-tab`}
      >
        {tab === "servers" && <ServersTab push={push} />}
        {tab === "backups" && <BackupsTab push={push} />}
        {tab === "system" && <SystemTab />}
      </div>
    </>
  );
}
