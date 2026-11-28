"use client";

import { useState, type FormEvent } from "react";
import { INPUT_CLASS } from "@/components/report/ReportField";
import { communityRequest, type Member, type Session } from "@/lib/community-api";
import { useCommunity } from "./useCommunity";

type Result = { readonly ok: boolean; readonly text: string } | null;
const CHANNELS = [
  ["notify_email", "Email", "email"],
  ["notify_sms", "SMS text", "sms"],
  ["notify_whatsapp", "WhatsApp", "whatsapp"],
] as const;

/** Reads a form into a JSON body; checkboxes become booleans. */
function formBody(form: HTMLFormElement): Record<string, string | boolean> {
  const body: Record<string, string | boolean> = {};
  for (const element of Array.from(form.elements) as HTMLInputElement[]) {
    if (!element.name) continue;
    body[element.name] = element.type === "checkbox" ? element.checked : element.value;
  }
  return body;
}

function Message({ result }: { readonly result: Result }) {
  return result ? (
    <p
      role={result.ok ? "status" : "alert"}
      className={result.ok ? "font-medium text-ink" : "font-medium text-warning"}
    >
      {result.text}
    </p>
  ) : null;
}

function TextField({
  name,
  label,
  type = "text",
  defaultValue,
  autoComplete,
  prefix,
}: {
  readonly name: string;
  readonly label: string;
  readonly type?: string;
  readonly defaultValue?: string | null;
  readonly autoComplete?: string;
  readonly prefix: string;
}) {
  return (
    <div>
      <label htmlFor={`${prefix}-${name}`} className="font-medium text-ink">
        {label}
      </label>
      <input
        id={`${prefix}-${name}`}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue ?? ""}
        className={INPUT_CLASS}
      />
    </div>
  );
}

function ChannelFields({
  member,
  session,
}: {
  readonly member?: Member;
  readonly session: Session;
}) {
  return (
    <fieldset className="space-y-1">
      <legend className="font-medium text-ink">Send me alerts by</legend>
      {CHANNELS.map(([name, label, channel]) => (
        <label key={name} className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            name={name}
            defaultChecked={member ? member[name] : name === "notify_email"}
          />
          {label}
          {session.channels[channel] ? null : (
            <span className="text-sm text-muted">(not set up on this server yet)</span>
          )}
        </label>
      ))}
      {member?.telegram_connected ? (
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" name="notify_telegram" defaultChecked={member.notify_telegram} />
          Telegram
        </label>
      ) : null}
    </fieldset>
  );
}

export function AccountPanel() {
  const { data: session, error, reload, setData } = useCommunity<Session>("/me");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [result, setResult] = useState<Result>(null);
  const [busy, setBusy] = useState(false);

  if (error) return <p role="alert">{error}</p>;
  if (!session) return <p role="status">Loading your account…</p>;

  async function send(path: string, body: unknown, method = "POST"): Promise<unknown> {
    setBusy(true);
    setResult(null);
    try {
      return await communityRequest(path, { body, method });
    } catch (failure) {
      setResult({
        ok: false,
        text: failure instanceof Error ? failure.message : "Please try again.",
      });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const path = mode === "signin" ? "/login" : "/signup";
    if (await send(path, formBody(event.currentTarget))) reload();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = (await send("/account", formBody(event.currentTarget), "PUT")) as {
      user: Member;
    } | null;
    if (saved && session) {
      setData({ ...session, user: saved.user });
      setResult({ ok: true, text: "Your settings were saved." });
    }
  }

  async function telegram(action: "connect" | "disconnect") {
    const reply = (await send("/account/telegram", { action })) as {
      url?: string;
      user?: Member;
    } | null;
    if (reply?.url) window.location.assign(reply.url);
    else if (reply?.user && session) setData({ ...session, user: reply.user });
  }

  async function test() {
    const reply = (await send("/account/test", {})) as { message: string } | null;
    if (reply) setResult({ ok: true, text: reply.message });
  }

  async function signOut() {
    if (await send("/logout", {})) reload();
  }

  const user = session.user;
  if (!user)
    return (
      <div className="max-w-prose space-y-5">
        <div role="group" aria-label="Account" className="flex gap-2">
          {(["signin", "signup"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => {
                setMode(value);
                setResult(null);
              }}
              className={mode === value ? "af-button-primary" : "af-button-secondary"}
            >
              {value === "signin" ? "Sign in" : "Create an account"}
            </button>
          ))}
        </div>
        <form
          key={mode}
          onSubmit={signIn}
          aria-label={mode === "signin" ? "Sign in" : "Create an account"}
          className="af-panel space-y-4 p-5"
        >
          {mode === "signup" ? (
            <TextField prefix="acct" name="name" label="Name" autoComplete="name" />
          ) : null}
          <TextField prefix="acct" name="email" label="Email" type="email" autoComplete="email" />
          {mode === "signup" ? (
            <>
              <TextField
                prefix="acct"
                name="zip"
                label="ZIP code (for local alerts)"
                autoComplete="postal-code"
              />
              <TextField
                prefix="acct"
                name="phone"
                label="Mobile with country code (optional)"
                type="tel"
                autoComplete="tel"
              />
              <ChannelFields session={session} />
            </>
          ) : null}
          <TextField
            prefix="acct"
            name="password"
            label="Password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
          {mode === "signup" ? (
            <TextField
              prefix="acct"
              name="confirm"
              label="Confirm password"
              type="password"
              autoComplete="new-password"
            />
          ) : null}
          <button type="submit" disabled={busy} className="af-button-primary">
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
        <Message result={result} />
      </div>
    );

  return (
    <div className="max-w-prose space-y-6">
      <form onSubmit={save} aria-label="Alert settings" className="af-panel space-y-4 p-5">
        <p className="text-muted">Signed in as {user.email}</p>
        <TextField
          prefix="acct"
          name="name"
          label="Name"
          defaultValue={user.name}
          autoComplete="name"
        />
        <TextField
          prefix="acct"
          name="zip"
          label="ZIP code"
          defaultValue={user.zip}
          autoComplete="postal-code"
        />
        <TextField
          prefix="acct"
          name="phone"
          label="Mobile with country code"
          type="tel"
          defaultValue={user.phone}
          autoComplete="tel"
        />
        <ChannelFields member={user} session={session} />
        <button type="submit" disabled={busy} className="af-button-primary">
          Save settings
        </button>
      </form>
      <section aria-label="WhatsApp bot" className="af-panel space-y-3 p-5">
        <h2 className="text-lg font-semibold text-ink">WhatsApp bot</h2>
        {session.whatsapp_bot ? (
          <>
            <p className="text-muted">
              Message {session.whatsapp_bot} to post an incident or a lost or found item, or forward
              messages from your neighborhood group. Messages from the phone number on your account
              are posted as you.
            </p>
            <a
              href={`https://wa.me/${session.whatsapp_bot.replace(/\D/g, "")}`}
              className="af-button-secondary inline-flex"
            >
              Message the bot on WhatsApp
            </a>
          </>
        ) : (
          <p className="text-muted">
            The WhatsApp bot isn&apos;t set up on this server yet. It turns on once an admin adds
            the Twilio WhatsApp settings.
          </p>
        )}
      </section>
      <section aria-label="Telegram" className="af-panel space-y-3 p-5">
        <h2 className="text-lg font-semibold text-ink">Telegram (free alerts)</h2>
        {user.telegram_connected ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void telegram("disconnect")}
            className="af-button-secondary"
          >
            Disconnect Telegram
          </button>
        ) : session.channels.telegram ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void telegram("connect")}
            className="af-button-secondary"
          >
            Connect Telegram
          </button>
        ) : (
          <p className="text-muted">The Telegram bot isn&apos;t set up on this server yet.</p>
        )}
      </section>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void test()}
          className="af-button-secondary"
        >
          Send a test alert
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void signOut()}
          className="af-button-secondary"
        >
          Sign out
        </button>
      </div>
      <Message result={result} />
    </div>
  );
}
