import clsx from "clsx";
import { isRed, rankLabel, suitOf, type BidSuit, type Card } from "@/lib/game";

const SUIT_PATH: Record<Exclude<BidSuit, "NT">, React.ReactNode> = {
  S: (
    <path d="M12 1C12 1 2.5 8 2.5 13.7c0 3 2.3 5 5 5 1.7 0 3-.7 3.9-1.9-.1 2-.8 3.6-2.3 5.2h6.8c-1.5-1.6-2.2-3.2-2.3-5.2.9 1.2 2.2 1.9 3.9 1.9 2.7 0 5-2 5-5C21.5 8 12 1 12 1z" />
  ),
  H: (
    <path d="M12 22.5S1.5 15.3 1.5 8.6C1.5 5.1 4 2.8 7 2.8c2.1 0 3.9 1 5 2.9 1.1-1.9 2.9-2.9 5-2.9 3 0 5.5 2.3 5.5 5.8 0 6.7-10.5 13.9-10.5 13.9z" />
  ),
  D: <path d="M12 .5 21.5 12 12 23.5 2.5 12z" />,
  C: (
    <>
      <circle cx="12" cy="6.6" r="5" />
      <circle cx="5.9" cy="14.2" r="5" />
      <circle cx="18.1" cy="14.2" r="5" />
      <circle cx="12" cy="12.2" r="3.6" />
      <path d="M10.9 12h2.2l1.9 10.5H9z" />
    </>
  ),
};

/** Suit shape drawn as SVG so it stays crisp and clubs/spades are easy to tell apart at any size. */
export function SuitIcon({ suit, className }: { suit: Exclude<BidSuit, "NT">; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={clsx("inline-block shrink-0", className)}>
      {SUIT_PATH[suit]}
    </svg>
  );
}

const SIZES = {
  xs: "w-8 h-11 rounded-md text-[10px]",
  sm: "w-11 h-16 rounded-md text-xs",
  md: "w-14 h-20 sm:w-16 sm:h-24 rounded-lg text-sm",
  lg: "w-14 h-20 min-[400px]:w-16 min-[400px]:h-24 sm:w-20 sm:h-28 rounded-lg text-base",
};

export function PlayingCard({
  card,
  size = "md",
  className,
  highlight,
  fan,
}: {
  card: Card;
  size?: keyof typeof SIZES;
  className?: string;
  highlight?: boolean;
  /** Overlapped in a hand on phones: big corner index only, since the centre pip would be half hidden. */
  fan?: boolean;
}) {
  const suit = suitOf(card);
  const rank = rankLabel(card);
  const small = size === "xs";
  // One fixed 100x140 drawing that scales with the card, so layout never depends on the card's size.
  const Pip = ({ x, y, w, className }: { x: number; y: number; w: number; className?: string }) => (
    <svg x={x} y={y} width={w} height={w} viewBox="0 0 24 24" fill="currentColor" className={className}>
      {SUIT_PATH[suit]}
    </svg>
  );
  const Corner = ({ big, className }: { big?: boolean; className?: string }) => (
    <g className={className}>
      <text x={big ? 17 : 15} y={big ? 36 : 29} textAnchor="middle" fontSize={rank === "10" ? (big ? 32 : 24) : big ? 36 : 28} fontWeight="700" fill="currentColor" fontFamily="inherit">
        {rank}
      </text>
      <Pip x={big ? 3 : 4} y={big ? 42 : 34} w={big ? 28 : 22} />
    </g>
  );
  return (
    <div
      className={clsx(
        "relative select-none border bg-card shadow-md",
        SIZES[size],
        highlight ? "border-gold ring-2 ring-gold" : "border-black/10",
        isRed(suit) ? "text-suit-red" : "text-suit-black",
        className,
      )}
      aria-label={`${rankLabel(card)} of ${suit}`}
    >
      <svg viewBox="0 0 100 140" className="absolute inset-0 size-full" aria-hidden>
        <Corner className={fan ? "max-sm:hidden" : undefined} />
        {fan && <Corner big className="hidden max-sm:block" />}
        {!small && (
          <g transform="rotate(180 50 70)" className={fan ? "max-sm:hidden" : undefined}>
            <Corner />
          </g>
        )}
        <Pip x={small ? 20 : 25} y={small ? 40 : 44} w={small ? 60 : 50} className={fan ? "max-sm:hidden" : undefined} />
      </svg>
    </div>
  );
}

export function CardBack({ className, size = "sm" }: { className?: string; size?: keyof typeof SIZES }) {
  return <div className={clsx("border border-white/20 shadow", SIZES[size], "card-back", className)} />;
}

export function SuitText({ suit, className }: { suit: BidSuit; className?: string }) {
  return (
    <span className={clsx(suit === "NT" ? "" : isRed(suit) ? "text-red-400" : "text-slate-100", className)}>
      {suit === "NT" ? "NT" : <SuitIcon suit={suit} className="size-[0.95em] -translate-y-[0.06em] align-middle" />}
    </span>
  );
}

export function BidText({ level, suit }: { level: number; suit: BidSuit }) {
  return (
    <span className="font-semibold tabular-nums">
      {level}
      <SuitText suit={suit} />
    </span>
  );
}

export function CardText({ card }: { card: Card }) {
  const suit = suitOf(card);
  return (
    <span className="font-semibold">
      {rankLabel(card)}
      <SuitText suit={suit} />
    </span>
  );
}
