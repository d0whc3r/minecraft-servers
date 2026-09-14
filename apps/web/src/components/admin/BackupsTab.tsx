// Backups tab: per-server backup library with create, download and restore.
import { useEffect, useMemo, useState } from "react";
import type { BackupFile, ServerStatus, StatusResponse } from "@/types";
import { api, formatBytes, timeAgo } from "@/lib/client";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import type { ToastPush } from "@/components/ui";
import {
  Button,
  buttonClass,
  cn,
  CountedFilterGroup,
  FilterSearch,
  inputClass,
  MONO,
} from "@/components/ui";
import { ConfirmModal } from "@/components/admin/ConfirmModal";

type BackupFilter = "all" | "checksum" | "unchecked";

const BACKUP_FILTERS: Array<[BackupFilter, string]> = [
  ["all", "All"],
  ["checksum", "Checksum"],
  ["unchecked", "No checksum"],
];

export function BackupsTab({ push }: { push: ToastPush }) {
  const [servers, setServers] = useState<ServerStatus[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [files, setFiles] = useState<BackupFile[]>([]);
  const [query, setQuery] = useState("");
  const [backupFilter, setBackupFilter] = useState<BackupFilter>("all");
  const [confirming, setConfirming] = useState<BackupFile | null>(null);

  useEffect(() => {
    api<StatusResponse>("/api/status").then((data) => {
      setServers(data.servers);
      setSelected((cur) => cur ?? data.servers[0]?.name ?? null);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    api<{ files: BackupFile[] }>(`/api/backups/${selected}`).then((res) =>
      setFiles(res.files),
    );
  }, [selected]);

  const createBackup = async () => {
    if (!selected) return;
    push(
      "info",
      "Backup started",
      `Creating a backup of ${selected}; this can take several minutes.`,
    );
    try {
      const res = await api<{ ok: boolean; output: string }>(
        `/api/action/${selected}/backup`,
        { method: "POST", json: {} },
      );
      push(
        res.ok ? "ok" : "err",
        `Backup of ${selected}: ${res.ok ? "done" : "failed"}`,
        res.output,
      );
      const listing = await api<{ files: BackupFile[] }>(
        `/api/backups/${selected}`,
      );
      setFiles(listing.files);
    } catch (err) {
      push("err", "Backup error", (err as Error).message);
    }
  };

  const restore = async (file: BackupFile) => {
    if (!selected) return;
    setConfirming(null);
    try {
      const res = await api<{ ok: boolean; output: string }>(
        `/api/backups/${selected}/restore`,
        { method: "POST", json: { file: file.file } },
      );
      push(
        res.ok ? "ok" : "err",
        `Restore: ${res.ok ? "done" : "failed"}`,
        res.output,
      );
    } catch (err) {
      push("err", "Restore error", (err as Error).message);
    }
  };

  const columns = useMemo<DataTableColumn<BackupFile>[]>(
    () => [
      {
        id: "file",
        header: "File",
        meta: { label: "File" },
        accessorKey: "file",
        enableHiding: false,
        cell: ({ row }) => (
          <span className={cn(MONO, "break-all")}>{row.original.file}</span>
        ),
      },
      {
        id: "size",
        header: "Size",
        meta: { label: "Size" },
        accessorKey: "sizeBytes",
        sortDescFirst: true,
        cell: ({ row }) => (
          <span className={MONO}>{formatBytes(row.original.sizeBytes)}</span>
        ),
      },
      {
        id: "date",
        header: "Date",
        meta: { label: "Date" },
        accessorFn: (f) => new Date(f.modified).getTime(),
        sortDescFirst: true,
        cell: ({ row }) => (
          <span className={MONO}>{timeAgo(row.original.modified)}</span>
        ),
      },
      {
        id: "checksum",
        header: "Checksum",
        meta: { label: "Checksum" },
        accessorFn: (f) => (f.hasChecksum ? 1 : 0),
        enableGlobalFilter: false,
        cell: ({ row }) => (row.original.hasChecksum ? "✓" : "—"),
      },
      {
        id: "actions",
        header: "Actions",
        meta: { label: "Actions" },
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const f = row.original;
          return (
            <div className="flex flex-wrap gap-1.5">
              <a
                className={buttonClass("default", "sm")}
                href={`/api/backups/${selected}/file?name=${encodeURIComponent(f.file)}`}
              >
                Download
              </a>
              <Button
                size="sm"
                variant="danger"
                onClick={() => setConfirming(f)}
              >
                Restore
              </Button>
            </div>
          );
        },
      },
    ],
    [selected],
  );

  const visibleFiles = useMemo(() => {
    let list = files;
    if (backupFilter === "checksum")
      list = list.filter((file) => file.hasChecksum);
    if (backupFilter === "unchecked")
      list = list.filter((file) => !file.hasChecksum);
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery)
      list = list.filter((file) =>
        file.file.toLowerCase().includes(normalizedQuery),
      );
    return list;
  }, [backupFilter, files, query]);

  const filterCounts: Record<BackupFilter, number> = {
    all: files.length,
    checksum: files.filter((file) => file.hasChecksum).length,
    unchecked: files.filter((file) => !file.hasChecksum).length,
  };
  const hasActiveFilters = query.trim() !== "" || backupFilter !== "all";

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="m-0 text-[1.1rem] font-bold tracking-[-0.02em]">
            Backup library
          </h2>
          <p className="mt-1 mb-0 text-[0.84rem] text-dim">
            Create, download or restore a world snapshot.
          </p>
        </div>
        <Button variant="primary" disabled={!selected} onClick={createBackup}>
          Create backup now
        </Button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-edge2 bg-panel/75 p-2.5">
        <select
          name="backup-server-filter"
          className={cn(inputClass, "w-auto min-w-55")}
          value={selected ?? ""}
          onChange={(event) => {
            setSelected(event.target.value);
            setFiles([]);
          }}
          aria-label="Filter backups by server"
        >
          {servers.length === 0 && <option value="">No servers</option>}
          {servers.map((server) => (
            <option key={server.name} value={server.name}>
              {server.title}
            </option>
          ))}
        </select>
        <FilterSearch
          name="backup-search"
          placeholder="Search backup files"
          value={query}
          onChange={setQuery}
          label="Search backups"
        />
        <CountedFilterGroup
          label="Filter backups by checksum"
          value={backupFilter}
          onChange={setBackupFilter}
          options={BACKUP_FILTERS.map(([value, label]) => ({
            value,
            label,
            count: filterCounts[value],
          }))}
        />
      </div>

      {hasActiveFilters && (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            className="cursor-pointer border-0 bg-transparent px-1 text-[0.78rem] font-semibold text-dim underline underline-offset-3 hover:text-ink"
            onClick={() => {
              setQuery("");
              setBackupFilter("all");
            }}
          >
            Clear filters
          </button>
        </div>
      )}

      <div className="sr-only" aria-live="polite">
        {visibleFiles.length} backups match the current filters.
      </div>

      <DataTable
        data={visibleFiles}
        columns={columns}
        initialSorting={[{ id: "date", desc: true }]}
        externalFiltering
        emptyMessage={
          hasActiveFilters
            ? "No backups match the current filters."
            : selected
              ? "No backups for this server yet. Create the first one."
              : "Pick a server."
        }
      />

      {confirming && (
        <ConfirmModal
          title="Confirm restore"
          confirmLabel="Yes, restore"
          onConfirm={() => void restore(confirming)}
          onCancel={() => setConfirming(null)}
        >
          <p>
            This will restore <span className={MONO}>{confirming.file}</span>{" "}
            into <span className={MONO}>{selected}</span>.<br />
            <strong>The current world will be replaced</strong> by the backup
            contents. This cannot be undone.
          </p>
        </ConfirmModal>
      )}
    </>
  );
}
