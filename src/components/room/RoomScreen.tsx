"use client";

import { Check, Copy, LogOut, MessageSquare, Square, Trophy, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "@/components/Toaster";
import { useRoom, type RoomData } from "@/hooks/useRoom";
import { api, loadNickname, saveNickname } from "@/lib/api";
import { NICKNAME_MAX } from "@/lib/rows";
import { GameTable } from "./GameTable";
import { Lobby } from "./Lobby";
import { Sidebar } from "./Sidebar";

export function RoomScreen({ code: rawCode }: { code: string }) {
  const { status, reload, code } = useRoom(rawCode);

  if (status.kind === "loading") return <FullScreenMessage>Shuffling…</FullScreenMessage>;
  if (status.kind === "error") return <FullScreenMessage>Couldn&apos;t connect: {status.message}</FullScreenMessage>;
  if (status.kind === "not-member") return <JoinGate code={code} onJoined={reload} />;

  return <Room code={code} userId={status.userId} data={status.data} online={status.online} />;
}

function Room({ code, userId, data, online }: { code: string; userId: string; data: RoomData; online: Set<string> }) {
  const router = useRouter();
  const [panel, setPanel] = useState<null | "side">(null);
  const lastChatId = data.chat.at(-1)?.id ?? 0;
  const [seenChatId, setSeenChatId] = useState(lastChatId);
  const me = data.players.find((p) => p.user_id === userId);
  const isHost = data.room.host_id === userId;
  const inGame = data.room.status === "playing" && data.game !== null;
  const unread = panel !== "side" && lastChatId > seenChatId;

  useEffect(() => {
    if (panel === "side") setSeenChatId(lastChatId);
  }, [lastChatId, panel]);

  async function leave() {
    try {
      await api("/api/rooms/leave", { code });
      router.push("/");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function endGame() {
    try {
      await api("/api/game/end", { code });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (!me) return <FullScreenMessage>You&apos;re no longer in this room.</FullScreenMessage>;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-line bg-panel/80 px-4 py-2.5 backdrop-blur">
        <Link href="/" className="font-display text-lg font-semibold text-card">
          Floating Bridge
        </Link>
        <CodeChip code={code} />
        {inGame && <span className="hidden text-sm text-muted sm:inline">Round {data.game!.round_no}</span>}
        <div className="ml-auto flex items-center gap-1">
          {isHost && inGame && (
            <HeaderButton onClick={endGame} label="End game">
              <Square className="size-4" />
            </HeaderButton>
          )}
          <HeaderButton onClick={() => setPanel(panel ? null : "side")} label="Scores & chat" className="lg:hidden">
            <span className="relative">
              <MessageSquare className="size-4" />
              {unread &&<span className="absolute -top-1.5 -right-1.5 size-2.5 rounded-full bg-gold" />}
            </span>
            <Trophy className="size-4" />
          </HeaderButton>
          <HeaderButton onClick={leave} label="Leave room">
            <LogOut className="size-4" />
          </HeaderButton>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-y-auto">
          {inGame ? (
            <GameTable code={code} data={data} me={me} online={online} />
          ) : (
            <Lobby code={code} data={data} me={me} isHost={isHost} online={online} />
          )}
        </main>

        <aside className="hidden w-80 shrink-0 border-l border-line bg-panel lg:flex">
          <Sidebar data={data} userId={userId} />
        </aside>

        {panel === "side" && (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <button className="flex-1 bg-black/50" aria-label="Close" onClick={() => setPanel(null)} />
            <div className="relative flex w-[min(22rem,90vw)] bg-panel shadow-2xl">
              <button
                onClick={() => setPanel(null)}
                className="absolute top-3 right-3 z-10 rounded p-1 text-muted hover:text-card"
                aria-label="Close panel"
              >
                <X className="size-5" />
              </button>
              <Sidebar data={data} userId={userId} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HeaderButton({
  children,
  onClick,
  label,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-muted transition hover:bg-panel-2 hover:text-card ${className}`}
    >
      {children}
    </button>
  );
}

export function CodeChip({ code, large }: { code: string; large?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(large ? `${location.origin}/room/${code}` : code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy. Select the code instead.");
    }
  }
  return (
    <button
      onClick={copy}
      title={large ? "Copy invite link" : "Copy room code"}
      className={`flex items-center gap-2 rounded-lg border border-line bg-ink font-mono tracking-[0.25em] text-gold transition hover:border-gold/60 ${
        large ? "px-5 py-3 text-3xl" : "px-2.5 py-1 text-sm"
      }`}
    >
      {code}
      {copied ? (
        <Check className={large ? "size-5" : "size-3.5"} />
      ) : (
        <Copy className={`${large ? "size-5" : "size-3.5"} text-muted`} />
      )}
    </button>
  );
}

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="felt grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="font-display text-2xl text-card">{children}</p>
        <Link href="/" className="mt-4 inline-block text-sm text-gold hover:underline">
          Back to home
        </Link>
      </div>
    </div>
  );
}

function JoinGate({ code, onJoined }: { code: string; onJoined: () => void }) {
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setNickname(loadNickname()), []);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    const name = nickname.trim();
    if (!name) return toast.error("Enter a nickname first.");
    setBusy(true);
    try {
      saveNickname(name);
      await api("/api/rooms/join", { code, nickname: name });
      onJoined();
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="felt grid min-h-dvh place-items-center p-4">
      <form onSubmit={join} className="w-full max-w-sm rounded-2xl border border-white/10 bg-ink/80 p-6 shadow-2xl">
        <p className="text-sm text-muted">You&apos;re joining room</p>
        <p className="mt-1 font-mono text-3xl tracking-[0.3em] text-gold">{code}</p>
        <label className="mt-6 block text-xs font-medium tracking-wider text-muted uppercase" htmlFor="gate-nick">
          Your name
        </label>
        <input
          id="gate-nick"
          value={nickname}
          maxLength={NICKNAME_MAX}
          onChange={(e) => setNickname(e.target.value)}
          className="mt-2 w-full rounded-lg border border-line bg-panel px-3 py-2.5 outline-none focus:border-gold"
          autoFocus
        />
        <button
          disabled={busy}
          className="mt-5 w-full rounded-lg bg-gold py-3 font-semibold text-ink transition hover:bg-gold-soft disabled:opacity-60"
        >
          {busy ? "Joining…" : "Take a seat"}
        </button>
        <Link href="/" className="mt-4 block text-center text-sm text-muted hover:text-card">
          Back
        </Link>
      </form>
    </div>
  );
}
