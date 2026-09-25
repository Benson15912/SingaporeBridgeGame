import clsx from "clsx";
import { isRed, rankLabel, suitOf, SUIT_SYMBOL, type BidSuit, type Card } from "@/lib/game";

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
        <span>{SUIT_SYMBOL[suit]}</span>
      </div>
      {size !== "xs" && (
        <div className="absolute right-[10%] bottom-[6%] flex rotate-180 flex-col items-center leading-none font-semibold">
          <span>{rankLabel(card)}</span>
          <span>{SUIT_SYMBOL[suit]}</span>
        </div>
      )}
      <div className="absolute inset-0 grid place-items-center text-[2.1em] leading-none">{SUIT_SYMBOL[suit]}</div>
    </div>
  );
}

export function CardBack({ className, size = "sm" }: { className?: string; size?: keyof typeof SIZES }) {
  return <div className={clsx("border border-white/20 shadow", SIZES[size], "card-back", className)} />;
}

export function SuitText({ suit, className }: { suit: BidSuit; className?: string }) {
  return (
    <span className={clsx(suit === "NT" ? "" : isRed(suit) ? "text-red-400" : "text-slate-100", className)}>
      {SUIT_SYMBOL[suit]}
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
