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
  lg: "w-16 h-24 sm:w-20 sm:h-28 rounded-lg text-base",
};

export function PlayingCard({
  card,
  size = "md",
  className,
  highlight,
}: {
  card: Card;
  size?: keyof typeof SIZES;
  className?: string;
  highlight?: boolean;
}) {
  const suit = suitOf(card);
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
      <div className="absolute top-[6%] left-[10%] flex flex-col items-center leading-none font-semibold">
        <span>{rankLabel(card)}</span>
        <SuitIcon suit={suit} className="size-[1.1em]" />
      </div>
      {size !== "xs" && (
        <div className="absolute right-[10%] bottom-[6%] flex rotate-180 flex-col items-center leading-none font-semibold">
          <span>{rankLabel(card)}</span>
          <SuitIcon suit={suit} className="size-[1.1em]" />
        </div>
      )}
      <div className="absolute inset-0 grid place-items-center">
        <SuitIcon suit={suit} className={size === "xs" ? "size-[2.2em]" : "size-[2.8em]"} />
      </div>
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
