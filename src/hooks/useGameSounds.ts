"use client";

import { useEffect, useRef } from "react";
import type { GameState, Seat } from "@/lib/game";
import type { ChatRow, GameRow } from "@/lib/rows";
import { playSound } from "@/lib/sounds";

const cardsPlayed = (s: GameState) =>
  s.tricksPlayed * 4 + (s.currentTrick && s.currentTrick.winner === null ? s.currentTrick.cards.length : 0);

/** Plays sound effects by comparing each new game state with the previous one. */
export function useGameSounds(
  game: GameRow | null,
  inGame: boolean,
  mySeat: Seat | undefined,
  chat: ChatRow[],
  userId: string,
) {
  const prevGame = useRef<GameRow | null | undefined>(undefined);
  const prevChatId = useRef<number | undefined>(undefined);

  useEffect(() => {
    const prev = prevGame.current;
    const current = inGame ? game : null;
    prevGame.current = current;
    // Nothing to compare against on first render, so stay quiet when (re)loading the page.
    if (prev === undefined || !current || mySeat === undefined) return;
    if (prev?.version === current.version && prev?.round_no === current.round_no) return;

    const s = current.state;
    const p = prev?.state;
    const newDeal = !p || prev!.round_no !== current.round_no || (s.notice !== null && s.notice !== p.notice);
    if (newDeal) {
      playSound("deal");
      return;
    }

    const later = (fn: () => void, ms: number) => setTimeout(fn, ms);

    if (s.bids.length > p.bids.length) playSound("bid");
    if (cardsPlayed(s) > cardsPlayed(p)) playSound("cardPlay");
    if (s.tricksPlayed > p.tricksPlayed && !s.result) later(() => playSound("trickWon"), 350);
    if (p.partnerRevealed === null && s.partnerRevealed !== null && !s.result) {
      later(() => playSound("partnerReveal"), 200);
    }
    if (s.result && !p.result) {
      const winners = s.result.declarerWon ? s.result.declarerSide : s.result.defenders;
      later(() => playSound(winners.includes(mySeat) ? "win" : "lose"), 400);
    }
    if (s.turn === mySeat && p.turn !== mySeat && s.phase !== "done") later(() => playSound("yourTurn"), 300);
  }, [game, inGame, mySeat]);

  useEffect(() => {
    const last = chat.at(-1);
    const prevId = prevChatId.current;
    prevChatId.current = last?.id ?? 0;
    if (prevId !== undefined && last && last.id > prevId && last.user_id !== userId) playSound("chat");
  }, [chat, userId]);
}
