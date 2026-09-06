import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/client";
import {
  Button,
  cn,
  Field,
  inputClass,
  Modal,
  type useToasts,
} from "@/components/ui";

interface ServerTypeOption {
  id: string;
  label: string;
  defaultVersion: string;
  modpackRequired: boolean;
}

type TypeCatalog =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; types: ServerTypeOption[] };

const MEMORY_OPTIONS = ["2G", "4G", "6G", "8G", "12G", "16G"];

export function CreateServerModal({
  onClose,
  onCreated,
  push,
}: {
  onClose: () => void;
  onCreated: (name: string, start: boolean) => void;
  push: ReturnType<typeof useToasts>["push"];
}) {
  const [catalog, setCatalog] = useState<TypeCatalog>({ status: "loading" });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [type, setType] = useState("paper");
  const [name, setName] = useState("");
  const [modpack, setModpack] = useState("");
  const [version, setVersion] = useState("");
  const [memory, setMemory] = useState("4G");
  const [maxPlayers, setMaxPlayers] = useState("20");
  const [difficulty, setDifficulty] = useState("normal");
  const [motd, setMotd] = useState("");
  const [extraEnv, setExtraEnv] = useState("");
  const [startNow, setStartNow] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api<{ types: ServerTypeOption[] }>("/api/servers", {
      signal: controller.signal,
    })
      .then(({ types }) => {
        if (controller.signal.aborted) return;
        if (!types.length) throw new Error("No server types are available.");
        setCatalog({ status: "ready", types });
        setType((current) =>
          types.some((option) => option.id === current) ? current : types[0].id,
        );
      })
      .catch((err: Error) => {
        if (!controller.signal.aborted) {
          setCatalog({ status: "error", message: err.message });
        }
      });
    return () => controller.abort();
  }, [loadAttempt]);

  const types = catalog.status === "ready" ? catalog.types : [];
  const typeSpec = types.find((t) => t.id === type);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending || !typeSpec) return;
    setSending(true);
    setError(null);
    try {
      const res = await api<{ name: string }>("/api/servers", {
        method: "POST",
        json: {
          name: name.trim().toLowerCase(),
          type,
          modpack: modpack.trim() || undefined,
          version: version.trim() || undefined,
          memory,
          maxPlayers: Number(maxPlayers),
          difficulty,
          motd: motd.trim() || undefined,
          extraEnv: extraEnv.trim() || undefined,
        },
      });
      onCreated(res.name, startNow);
    } catch (err) {
      setError((err as Error).message);
      push("err", "Create server: error", (err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal title="New server" onClose={onClose} dismissible={!sending} wide>
      <form onSubmit={submit} aria-busy={sending}>
        <fieldset
          disabled={sending}
          className="m-0 flex min-w-0 flex-col gap-3.5 border-0 p-0"
        >
          {catalog.status === "loading" && (
            <p role="status" className="m-0 text-sm text-dim">
              Loading server types…
            </p>
          )}
          {catalog.status === "error" && (
            <div className="rounded-lg border border-bad/50 bg-bad/10 px-3.5 py-2">
              <p role="alert" className="mb-2 text-sm">
                Could not load server types: {catalog.message}
              </p>
              <Button
                onClick={() => {
                  setCatalog({ status: "loading" });
                  setLoadAttempt((attempt) => attempt + 1);
                }}
              >
                Retry
              </Button>
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="m-0 rounded-lg border border-bad/50 bg-bad/10 px-3.5 py-2 text-[0.9rem]"
            >
              {error}
            </p>
          )}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
            <Field label="Server type">
              <select
                className={cn(inputClass, "w-full")}
                value={type}
                disabled={catalog.status !== "ready"}
                onChange={(e) => setType(e.target.value)}
              >
                {!types.length && <option value={type}>Unavailable</option>}
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Server name (players connect via <name>.domain)">
              <input
                className={cn(inputClass, "font-mono")}
                value={name}
                onChange={(e) =>
                  setName(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]+/g, "-")
                      .replace(/^-+/g, ""),
                  )
                }
                placeholder="my-server"
                pattern="[a-z0-9][a-z0-9\-]{0,38}[a-z0-9]"
                maxLength={40}
                required
              />
            </Field>
          </div>
          {typeSpec?.modpackRequired && (
            <Field label={`Modpack (${typeSpec.label}: URL or slug)`}>
              <input
                className={cn(inputClass, "font-mono")}
                value={modpack}
                onChange={(e) => setModpack(e.target.value)}
                placeholder={
                  type === "modrinth"
                    ? "https://modrinth.com/modpack/…"
                    : "https://www.curseforge.com/minecraft/modpacks/…"
                }
                required
              />
            </Field>
          )}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3.5">
            <Field label="Minecraft version">
              <input
                className={cn(inputClass, "font-mono")}
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder={typeSpec?.defaultVersion || "pack decides"}
              />
            </Field>
            <Field label="Memory">
              <select
                className={cn(inputClass, "w-full")}
                value={memory}
                onChange={(e) => setMemory(e.target.value)}
              >
                {MEMORY_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Max players">
              <input
                className={inputClass}
                type="number"
                min={1}
                max={1000}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
                required
              />
            </Field>
            <Field label="Difficulty">
              <select
                className={cn(inputClass, "w-full")}
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                {["peaceful", "easy", "normal", "hard"].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="MOTD (optional)">
            <input
              className={inputClass}
              value={motd}
              onChange={(e) => setMotd(e.target.value)}
              placeholder="Welcome to my server!"
              maxLength={120}
            />
          </Field>
          <Field label="Extra settings (optional, one KEY=VALUE per line)">
            <textarea
              className={cn(inputClass, "min-h-20 font-mono text-[0.85rem]")}
              value={extraEnv}
              onChange={(e) => setExtraEnv(e.target.value)}
              placeholder={"VIEW_DISTANCE=12\nPVP=true"}
              spellCheck={false}
            />
          </Field>
          <label className="inline-flex items-center gap-1.5 text-[0.88rem] text-dim">
            <input
              type="checkbox"
              checked={startNow}
              onChange={(e) => setStartNow(e.target.checked)}
            />
            Start the server right after creating it
          </label>
          <p className="m-0 text-[0.82rem] text-dim">
            The config is written to disk immediately (a free RCON port is
            assigned automatically); the first start downloads the server or
            modpack and can take several minutes.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              type="submit"
              disabled={sending || !typeSpec}
            >
              {sending ? "Creating…" : "Create server"}
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
