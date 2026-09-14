// Admin sign-in screen: credentials form with show/hide password toggle.
import { useState, type FormEvent } from "react";
import { api } from "@/lib/client";
import { Button, cn, Field, inputClass } from "@/components/ui";

export function Login({ onDone }: { onDone: () => void }) {
  const [user, setUser] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await api("/api/auth/login", {
        method: "POST",
        json: { user, password },
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="mx-auto mt-[clamp(1rem,7vh,5rem)] grid w-full max-w-[860px] overflow-hidden rounded-3xl border border-edge bg-panel shadow-[0_30px_80px_rgba(0,0,0,0.22)] md:grid-cols-[1.05fr_1fr]">
      <div className="relative flex min-h-105 flex-col justify-between overflow-hidden border-r border-edge2 bg-raise/55 p-8 max-md:min-h-64 max-md:border-r-0 max-md:border-b">
        <div
          aria-hidden="true"
          className="absolute -top-14 -right-12 size-48 rotate-12 border border-ok/10 bg-ok/[0.035] shadow-[0_0_0_24px_rgba(105,221,160,0.02),0_0_0_48px_rgba(105,221,160,0.015)]"
        />
        <span className="grid size-12 place-items-center rounded-2xl border border-ok/25 bg-ok/10 text-ok">
          <svg
            viewBox="0 0 24 24"
            className="size-6 fill-none stroke-current stroke-[1.6]"
            aria-hidden="true"
          >
            <path d="M12 3 5 6v5.5c0 4.4 2.7 7.4 7 9.5 4.3-2.1 7-5.1 7-9.5V6l-7-3Z" />
            <path d="M9.3 11.2V9.8a2.7 2.7 0 0 1 5.4 0v1.4M8.5 11.2h7v5h-7z" />
          </svg>
        </span>
        <div className="relative">
          <h1 className="m-0 max-w-xs text-[clamp(1.8rem,4vw,2.55rem)] leading-[1.08] font-bold tracking-[-0.045em]">
            Your control room is protected.
          </h1>
          <p className="mt-3 mb-0 max-w-sm leading-relaxed text-dim">
            Sign in to start and stop servers, run console commands, and manage
            backups.
          </p>
        </div>
      </div>
      <form
        className="flex flex-col justify-center gap-4 p-8 max-sm:p-5"
        onSubmit={submit}
      >
        <div className="mb-2">
          <h2 className="m-0 text-xl font-bold tracking-[-0.025em]">
            Admin sign in
          </h2>
          <p className="mt-1.5 mb-0 text-sm text-dim">
            Use your panel credentials to continue.
          </p>
        </div>
        {error && (
          <p
            role="alert"
            className="m-0 rounded-lg border border-bad/50 bg-bad/10 px-3.5 py-2 text-[0.9rem]"
          >
            {error}
          </p>
        )}
        <Field label="Username">
          <input
            className={inputClass}
            name="username"
            spellCheck={false}
            value={user}
            onChange={(e) => setUser(e.target.value)}
            autoComplete="username"
            required
          />
        </Field>
        {/* Not Field(): a <label> cannot wrap the show-password button. */}
        <div className="flex flex-col gap-1 text-[0.85rem] text-dim">
          <label htmlFor="admin-password" className="font-semibold">
            Password
          </label>
          <div className="relative">
            <input
              id="admin-password"
              className={cn(inputClass, "w-full pr-16")}
              name="password"
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              aria-pressed={showPass}
              aria-label={showPass ? "Hide credentials" : "Show credentials"}
              className="absolute inset-y-0 right-1.5 my-auto h-7 cursor-pointer rounded-md border-0 bg-transparent px-2 font-sans text-[0.78rem] font-semibold text-dim transition-colors hover:bg-raise hover:text-ink"
            >
              {showPass ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <Button
          className="mt-1 w-full"
          variant="primary"
          type="submit"
          disabled={sending}
        >
          {sending ? "Checking…" : "Sign in"}
        </Button>
      </form>
    </section>
  );
}
