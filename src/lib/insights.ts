import type { HistoryRow } from "./rows";

export interface Tally {
  played: number;
  won: number;
}
export const rate = (t: Tally) => (t.played ? t.won / t.played : 0);

export interface PlayerInsight {
  userId: string;
  declarer: Tally;
  partner: Tally;
  defender: Tally;
}

export interface Duo {
  a: string;
  b: string;
  tally: Tally;
}

const empty = (): Tally => ({ played: 0, won: 0 });

/** Role records for each player and win records for every declarer + partner pairing. */
export function computeInsights(history: HistoryRow[], userIds: string[]) {
  const players = new Map<string, PlayerInsight>(
    userIds.map((id) => [id, { userId: id, declarer: empty(), partner: empty(), defender: empty() }]),
  );
  const duos = new Map<string, Duo>();
  const bump = (t: Tally, won: boolean) => {
    t.played++;
    if (won) t.won++;
  };

  for (const h of history) {
    for (const [id, p] of players) {
      if (id === h.declarer_id) bump(p.declarer, h.declarer_won);
      else if (id === h.partner_id) bump(p.partner, h.declarer_won);
      else bump(p.defender, !h.declarer_won);
    }
    const [a, b] = [h.declarer_id, h.partner_id].sort();
    const key = `${a}|${b}`;
    const duo = duos.get(key) ?? { a, b, tally: empty() };
    bump(duo.tally, h.declarer_won);
    duos.set(key, duo);
  }

  const list = [...players.values()];
  const byRate = (pick: (p: PlayerInsight) => Tally) =>
    list
      .filter((p) => pick(p).played > 0)
      .sort((x, y) => rate(pick(y)) - rate(pick(x)) || pick(y).played - pick(x).played);

  return {
    players: list,
    bestPartners: byRate((p) => p.partner),
    bestDeclarers: byRate((p) => p.declarer),
    duos: [...duos.values()]
      .filter((d) => players.has(d.a) && players.has(d.b))
      .sort((x, y) => rate(y.tally) - rate(x.tally) || y.tally.played - x.tally.played),
    rounds: history.length,
  };
}
