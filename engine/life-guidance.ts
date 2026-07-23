// ─────────────────────────────────────────────────────────────────────────────
// AstroIndicators · "What to do with this" — concrete, behaviour-level guidance.
// Names the internal friction a placement creates, then converts it into ONE
// decisive behavioural choice, correlated to the HOUSE the planet occupies.
// Heavy actors only (Saturn, Mars, Rahu, Ketu, Moon, Venus, Sun) — the planets
// whose placement actually changes how a person should carry themselves.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChartData, Graha } from "./chart-core";
import { weakDig, veryStrong, dusthana } from "./shared";

export interface GuidanceLine { actor: Graha; house: number; text: string; }

// house → the life-arena it colours, in plain words
const ARENA: Record<number, string> = {
  1: "your very self, body, and how you show up",
  2: "your money, speech, and family",
  3: "your drive, courage, and communication",
  4: "your home, peace of mind, and inner foundation",
  5: "your creativity, children, and judgment",
  6: "conflict, health, work, and daily obstacles",
  7: "marriage, partnership, and close dealings",
  8: "transformation, shared resources, and hidden matters",
  9: "belief, fortune, and higher purpose",
  10: "career, standing, and public conduct",
  11: "gains, networks, and desires",
  12: "letting go, expenses, solitude, and the inner world",
};

export function lifeGuidance(c: ChartData): GuidanceLine[] {
  const g = c.grahas;
  const out: GuidanceLine[] = [];
  const push = (actor: Graha, text: string) => out.push({ actor, house: g[actor].house, text });
  const stressed = (p: Graha) => weakDig(c.dignityD1(p)) || dusthana(g[p].house) || g[p].combust;
  const H = (p: Graha) => g[p].house;
  const arena = (p: Graha) => ARENA[g[p].house];

  // ── SATURN — restriction, fear, discipline, delay ──────────────────────────
  {
    const h = H("Saturn");
    if (stressed("Saturn") || dusthana(h)) {
      push("Saturn", `Saturn asks for patience in ${arena("Saturn")}. The friction is between wanting results now and a chart that rewards the long game — so treat delay as instruction, not defeat. Consistent, unglamorous effort is not a compromise here; it is the deciding factor.`);
    } else if (veryStrong(c.dignityD1("Saturn"))) {
      push("Saturn", `A strong Saturn makes discipline in ${arena("Saturn")} your quiet superpower — lean on structure and follow-through deliberately rather than assuming it will hold on its own.`);
    }
  }

  // ── MARS — impulse, anger, courage, haste ──────────────────────────────────
  if (H("Mars") <= 12) {
    const h = H("Mars");
    const conflictHouse = [1,3,6,8].includes(h);
    push("Mars", `Be conscious of impulsive thoughts and quick reactions in ${arena("Mars")}. ${conflictHouse ? "Your Mars sits where friction is easily lit" : "Mars gives real drive here"} — the choice that decides outcomes is to convert that heat into deliberate, assertive action rather than letting it spill into haste or conflict.`);
  }

  // ── RAHU — obsession, over-reach, boundary-blurring hunger ──────────────────
  {
    const h = H("Rahu");
    push("Rahu", `Rahu magnifies ${arena("Rahu")} — an appetite that is rarely satisfied by more of the same. The friction is between ambition and enough; your success rests on channelling that hunger toward one clear aim rather than chasing in every direction.`);
  }

  // ── KETU — detachment, self-doubt, spiritual pull vs worldly duty ───────────
  {
    const h = H("Ketu");
    push("Ketu", `Be aware of self-limiting doubt around ${arena("Ketu")} — Ketu can quietly withdraw you from exactly where you are capable. Notice those moments of "I can't" or "it doesn't matter," and choose to rise to the occasion when it genuinely needs you.`);
  }

  // ── MOON — mind, emotional steadiness, wellbeing ────────────────────────────
  {
    const h = H("Moon");
    if (stressed("Moon") || dusthana(h)) {
      push("Moon", `Protecting your mental peace is not optional self-care — it directly governs your vitality and health. With the Moon touching ${arena("Moon")}, guard your sleep, routines, and emotional inputs proactively and with real care; steadiness here holds up everything else.`);
    } else {
      push("Moon", `Your Moon is steady — a genuine asset. Keep the routines and relationships that ground you, because your emotional balance is what quietly powers the rest of your chart.`);
    }
  }

  // ── VENUS — pleasure, relationship, values, indulgence ─────────────────────
  {
    const h = H("Venus");
    if (stressed("Venus") || [7,8,12].includes(h)) {
      push("Venus", `Be cautious of over-indulgence in comfort and pleasure, and navigate relationship challenges around ${arena("Venus")} amicably rather than avoiding them. Where an easier pleasure tempts you off course, consciously choose a healthier one — Venus rewards refined enjoyment, not escape.`);
    }
  }

  // ── SUN — ego, authority, recognition ──────────────────────────────────────
  {
    const h = H("Sun");
    if (dusthana(h) || weakDig(c.dignityD1("Sun"))) {
      push("Sun", `Your sense of standing in ${arena("Sun")} can feel shaky, which tempts either withdrawal or over-assertion. The steadying choice is quiet confidence — let competence speak before position does, and recognition follows.`);
    }
  }

  // keep the sharpest 5 (heaviest placements first)
  const weight = (l: GuidanceLine) => (dusthana(l.house) ? 2 : 0) + (["Saturn","Rahu","Ketu","Mars"].includes(l.actor) ? 1 : 0);
  return out.sort((a,b) => weight(b) - weight(a)).slice(0, 5);
}
