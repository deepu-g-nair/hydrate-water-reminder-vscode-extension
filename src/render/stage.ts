/**
 * Character rendering layer + animation engine (pure: no VS Code imports).
 *
 * Builds one self-animating SVG "stage" per phase. Every movement is a CSS
 * animation inside the SVG, so after VS Code paints it the extension host
 * does no per-frame work.
 *
 * The "3D" look is built from four things, all plain SVG:
 *   1. every flat fill is replaced by a lit, rounded-looking gradient;
 *   2. a soft ground shadow that shrinks when the character leaves the ground;
 *   3. depth layers in the head (ears behind, face in front) that slide against
 *      each other when the character looks around;
 *   4. movement in depth (running in from far away, turning around).
 * It is a 3D look, not a 3D model: the editor can only show a flat image.
 */
import { getCharacter } from '../characters';
import { drawCharacter } from '../characters/rig';
import { Entry, ExitSetting, IDLE_MS, NUDGE_COUNT, NUDGE_IDLE_MS, NUDGE_MS, Size, SIZE, Speed, timings } from './animations';

/** enter: arrive + idle. wait: a short "nudge" while waiting. ack / dismiss: leave. */
export type Phase = 'enter' | 'wait' | 'ack' | 'dismiss';

export interface StageOptions {
  phase: Phase;
  character: string;
  entry: Entry;
  exit: ExitSetting;
  speed: Speed;
  size: Size;
  message: string;
  /** Celebration text shown in the 'ack' phase. */
  ackMessage?: string;
  /** Which nudge to play in the 'wait' phase. */
  nudge?: number;
  dark: boolean;
  /** Makes each stage a unique image so its animation timeline starts fresh. */
  nonce: string;
}

const W = 460, H = 300, G = 284; // stage size and ground line
const REST_X = 70;               // where the character stands
const OFF = -150;                // off-stage to the left (clipped by the viewport)
const DEPTH = 215;               // fully underground

export const DEFAULT_ACK_MESSAGE = 'Yay! Stay hydrated! 🎉';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function wrap(text: string, max = 32, maxLines = 3): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const word of text.trim().split(/\s+/)) {
    if (cur && (cur + ' ' + word).length > max) { lines.push(cur); cur = word; }
    else cur = cur ? cur + ' ' + word : word;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,2}$/, '…');
  }
  return lines;
}

/** Blend a #rrggbb colour towards white (255) or black (0). */
function mix(hex: string, target: 0 | 255, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * (1 - amount) + target * amount);
  return '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('');
}

/**
 * Give flat artwork volume: every `fill="#rrggbb"` becomes a radial gradient lit
 * from the top-left, so each shape reads as a rounded, solid form.
 */
export function shade3d(markup: string): { markup: string; defs: string } {
  const ids = new Map<string, string>();
  const out = markup.replace(/fill="(#[0-9a-fA-F]{6})"/g, (_m, c: string) => {
    const key = c.toLowerCase();
    let id = ids.get(key);
    if (!id) { id = `g${ids.size}`; ids.set(key, id); }
    return `fill="url(#${id})"`;
  });
  const defs = [...ids].map(([c, id]) =>
    `<radialGradient id="${id}" cx=".34" cy=".28" r=".9"><stop offset="0" stop-color="${mix(c, 255, 0.36)}"/>` +
    `<stop offset=".5" stop-color="${c}"/><stop offset="1" stop-color="${mix(c, 0, 0.28)}"/></radialGradient>`).join('');
  return { markup: out, defs };
}

const star = (cx: number, cy: number, r: number) => {
  const i = r * 0.3;
  return `M${cx},${cy - r} L${cx + i},${cy - i} L${cx + r},${cy} L${cx + i},${cy + i} L${cx},${cy + r} L${cx - i},${cy + i} L${cx - r},${cy} L${cx - i},${cy - i} z`;
};

const KEYFRAMES = `
/* basics */
@keyframes bob{to{transform:translateY(-4px)}}
@keyframes stepA{0%,100%{transform:rotate(0)}25%{transform:rotate(24deg)}75%{transform:rotate(-24deg)}}
@keyframes stepB{0%,100%{transform:rotate(0)}25%{transform:rotate(-24deg)}75%{transform:rotate(24deg)}}
@keyframes sway{0%,100%{transform:rotate(0)}25%{transform:rotate(3.5deg)}75%{transform:rotate(-3.5deg)}}
@keyframes flutter{to{transform:scaleX(.8)}}
@keyframes breathe{50%{transform:scale(1.012,.985)}}
@keyframes blink{0%,94%,100%{transform:scaleY(1)}97%{transform:scaleY(.1)}}
@keyframes flap{0%,80%,100%{transform:scaleX(1)}90%{transform:scaleX(.88)}}
@keyframes nod{50%{transform:rotate(4deg)}}
@keyframes lookF{0%,100%{transform:translateX(0)}18%,38%{transform:translateX(6px)}62%,82%{transform:translateX(-5px)}}
@keyframes lookB{0%,100%{transform:translateX(0)}18%,38%{transform:translateX(-3.5px)}62%,82%{transform:translateX(3px)}}
@keyframes pop{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes pulse{50%{transform:scale(1.06)}}
@keyframes fade{to{opacity:0}}
@keyframes inX{from{transform:translateX(${OFF}px)}to{transform:translateX(0)}}
@keyframes outX{from{transform:translateX(0)}to{transform:translateX(${OFF}px)}}
@keyframes hop{to{transform:translateY(-20px)}}
@keyframes jump{to{transform:translateY(-36px)}}
@keyframes offer{to{transform:rotate(-105deg)}}
@keyframes lower{from{transform:rotate(-105deg)}to{transform:rotate(0)}}
@keyframes hold{0%,100%{transform:rotate(-105deg)}50%{transform:rotate(-94deg)}}
@keyframes shakeB{0%,100%{transform:rotate(-105deg)}15%{transform:rotate(-130deg)}30%{transform:rotate(-96deg)}45%{transform:rotate(-130deg)}60%{transform:rotate(-96deg)}75%{transform:rotate(-126deg)}}
@keyframes tap{50%{transform:rotate(-16deg)}}
@keyframes cheerA{0%,100%{transform:rotate(150deg)}50%{transform:rotate(168deg)}}
@keyframes cheerB{0%,100%{transform:rotate(-150deg)}50%{transform:rotate(-168deg)}}
@keyframes waveB{0%,100%{transform:rotate(-155deg)}50%{transform:rotate(-112deg)}}
@keyframes turn{from{transform:rotateY(0deg)}to{transform:rotateY(180deg)}}
@keyframes spinHop{0%{transform:rotateY(0deg) translateY(0)}50%{transform:rotateY(180deg) translateY(-24px)}100%{transform:rotateY(360deg) translateY(0)}}
@keyframes wide{0%,62%{transform:scale(1.4)}82%,100%{transform:scale(1)}}
@keyframes wideOut{0%{transform:scale(1)}12%,100%{transform:scale(1.4)}}
@keyframes puff{0%{transform:translate(0,0) scale(.3);opacity:0}12%{opacity:.75}100%{transform:translate(var(--px),var(--py)) scale(1.8);opacity:0}}
@keyframes smoke{0%{transform:translate(0,0) scale(.2);opacity:0}14%{opacity:.95}100%{transform:translate(var(--px),var(--py)) scale(1.7);opacity:0}}
@keyframes twinkle{0%{transform:scale(0) rotate(0deg);opacity:0}40%{transform:scale(1.2) rotate(40deg);opacity:1}100%{transform:scale(0) rotate(90deg);opacity:0}}
@keyframes lines{0%{opacity:0}8%,42%{opacity:.75}60%,100%{opacity:0}}
@keyframes linesOut{0%,15%{opacity:0}30%,100%{opacity:.75}}
@keyframes sweat{0%{transform:translate(0,0);opacity:0}20%{opacity:1}100%{transform:translate(16px,-20px);opacity:0}}

/* ground shadow */
@keyframes shHop{to{transform:scale(.72);opacity:.6}}
@keyframes shHopsIn{0%{transform:scale(1);opacity:1}17%{transform:scale(.55);opacity:.5}33%,37%{transform:scale(1.05);opacity:1}52%{transform:scale(.68);opacity:.65}66%,70%{transform:scale(1.04);opacity:1}82%{transform:scale(.84);opacity:.8}93%,100%{transform:scale(1);opacity:1}}
@keyframes shHopsOut{0%{transform:scale(1);opacity:1}18%{transform:scale(.78);opacity:.75}34%,38%{transform:scale(1.04);opacity:1}56%{transform:scale(.62);opacity:.6}72%,76%{transform:scale(1.04);opacity:1}100%{transform:scale(.5);opacity:.4}}
@keyframes shFall{0%{transform:scale(.2);opacity:0}84%,100%{transform:scale(1);opacity:1}}
@keyframes shFloat{0%{transform:scale(.2);opacity:0}90%,100%{transform:scale(1);opacity:1}}
@keyframes shFloatOut{0%,24%{transform:scale(1);opacity:1}70%,100%{transform:scale(.2);opacity:0}}
@keyframes shPeek{0%,72%{transform:scale(1);opacity:1}86%{transform:scale(.6);opacity:.5}96%,100%{transform:scale(1);opacity:1}}
@keyframes shLate{0%,84%{opacity:0}100%{opacity:1}}
@keyframes shFadeIn{from{opacity:0}to{opacity:1}}
@keyframes shFadeOut{to{opacity:0}}

/* slide = slipping on a wet floor */
@keyframes slipIn{0%{transform:translateX(${OFF}px);animation-timing-function:cubic-bezier(.1,.6,.3,1)}55%{transform:translateX(28px)}72%{transform:translateX(16px)}100%{transform:translateX(0)}}
@keyframes slipTilt{0%{transform:rotate(-24deg)}50%{transform:rotate(-27deg)}62%{transform:rotate(15deg)}74%{transform:rotate(-9deg)}85%{transform:rotate(5deg)}94%{transform:rotate(-2deg)}100%{transform:rotate(0)}}
@keyframes slipLegA{0%{transform:rotate(-52deg)}25%{transform:rotate(-34deg)}50%{transform:rotate(-46deg)}62%{transform:rotate(12deg)}74%{transform:rotate(-7deg)}100%{transform:rotate(0)}}
@keyframes slipLegB{0%{transform:rotate(-30deg)}25%{transform:rotate(-56deg)}50%{transform:rotate(-58deg)}62%{transform:rotate(20deg)}74%{transform:rotate(-4deg)}100%{transform:rotate(0)}}
@keyframes slipArmA{0%{transform:rotate(160deg)}12%{transform:rotate(60deg)}24%{transform:rotate(170deg)}36%{transform:rotate(70deg)}50%{transform:rotate(165deg)}62%{transform:rotate(100deg)}74%{transform:rotate(60deg)}86%{transform:rotate(25deg)}100%{transform:rotate(0)}}
@keyframes slipArmB{0%{transform:rotate(-70deg)}12%{transform:rotate(-165deg)}24%{transform:rotate(-80deg)}36%{transform:rotate(-170deg)}50%{transform:rotate(-90deg)}62%{transform:rotate(-115deg)}74%{transform:rotate(-55deg)}86%{transform:rotate(-20deg)}100%{transform:rotate(0)}}
@keyframes slipHead{0%,50%{transform:rotate(-9deg)}62%{transform:rotate(10deg)}74%{transform:rotate(-5deg)}88%,100%{transform:rotate(0)}}
@keyframes slipOut{0%{transform:translateX(0)}16%{transform:translateX(12px);animation-timing-function:cubic-bezier(.5,0,.9,.6)}100%{transform:translateX(${OFF - 30}px)}}
@keyframes slipOutTilt{0%{transform:rotate(0)}8%{transform:rotate(6deg)}20%{transform:rotate(-28deg)}60%{transform:rotate(-34deg)}100%{transform:rotate(-30deg)}}
@keyframes slipOutLegA{0%{transform:rotate(0)}18%{transform:rotate(-58deg)}40%{transform:rotate(-36deg)}60%{transform:rotate(-60deg)}80%{transform:rotate(-40deg)}100%{transform:rotate(-55deg)}}
@keyframes slipOutLegB{0%{transform:rotate(0)}18%{transform:rotate(-38deg)}40%{transform:rotate(-62deg)}60%{transform:rotate(-36deg)}80%{transform:rotate(-60deg)}100%{transform:rotate(-42deg)}}
@keyframes slipOutArmA{0%{transform:rotate(0)}18%{transform:rotate(165deg)}34%{transform:rotate(70deg)}50%{transform:rotate(170deg)}66%{transform:rotate(75deg)}82%{transform:rotate(165deg)}100%{transform:rotate(90deg)}}
@keyframes slipOutArmB{0%{transform:rotate(0)}18%{transform:rotate(-80deg)}34%{transform:rotate(-170deg)}50%{transform:rotate(-85deg)}66%{transform:rotate(-168deg)}82%{transform:rotate(-80deg)}100%{transform:rotate(-150deg)}}

/* bounce */
@keyframes hopsIn{0%{transform:translateY(0) scale(1,1);animation-timing-function:cubic-bezier(.3,.7,.6,1)}17%{transform:translateY(-56px) scale(.96,1.05);animation-timing-function:cubic-bezier(.4,0,.7,.3)}33%{transform:translateY(0) scale(1.12,.86)}37%{transform:translateY(0) scale(1,1);animation-timing-function:cubic-bezier(.3,.7,.6,1)}52%{transform:translateY(-36px) scale(.97,1.04);animation-timing-function:cubic-bezier(.4,0,.7,.3)}66%{transform:translateY(0) scale(1.09,.9)}70%{transform:translateY(0) scale(1,1);animation-timing-function:cubic-bezier(.3,.7,.6,1)}82%{transform:translateY(-18px) scale(1,1);animation-timing-function:cubic-bezier(.4,0,.7,.3)}93%{transform:translateY(0) scale(1.05,.95)}100%{transform:translateY(0) scale(1,1)}}
@keyframes hopsOut{0%{transform:translateY(0) scale(1.08,.9);animation-timing-function:cubic-bezier(.3,.7,.6,1)}18%{transform:translateY(-26px) scale(.98,1.03);animation-timing-function:cubic-bezier(.4,0,.7,.3)}34%{transform:translateY(0) scale(1.09,.9)}38%{transform:translateY(0) scale(1,1);animation-timing-function:cubic-bezier(.3,.7,.6,1)}56%{transform:translateY(-44px) scale(.97,1.04);animation-timing-function:cubic-bezier(.4,0,.7,.3)}72%{transform:translateY(0) scale(1.1,.88)}76%{transform:translateY(0) scale(1,1);animation-timing-function:cubic-bezier(.3,.7,.6,1)}100%{transform:translateY(-60px) scale(.96,1.05)}}
@keyframes hopArmA{0%{transform:rotate(20deg)}17%{transform:rotate(155deg)}33%{transform:rotate(30deg)}37%{transform:rotate(20deg)}52%{transform:rotate(145deg)}66%{transform:rotate(25deg)}70%{transform:rotate(15deg)}82%{transform:rotate(120deg)}93%{transform:rotate(15deg)}100%{transform:rotate(0)}}
@keyframes hopArmB{0%{transform:rotate(-20deg)}17%{transform:rotate(-155deg)}33%{transform:rotate(-30deg)}37%{transform:rotate(-20deg)}52%{transform:rotate(-145deg)}66%{transform:rotate(-25deg)}70%{transform:rotate(-15deg)}82%{transform:rotate(-120deg)}93%{transform:rotate(-15deg)}100%{transform:rotate(0)}}
@keyframes hopLegA{0%,33%,37%,66%,70%,93%,100%{transform:rotate(0)}17%{transform:rotate(30deg)}52%{transform:rotate(25deg)}82%{transform:rotate(16deg)}}
@keyframes hopLegB{0%,33%,37%,66%,70%,93%,100%{transform:rotate(0)}17%{transform:rotate(-30deg)}52%{transform:rotate(-25deg)}82%{transform:rotate(-16deg)}}
@keyframes hopHead{0%,100%{transform:rotate(0)}17%{transform:rotate(-6deg)}33%{transform:rotate(7deg)}52%{transform:rotate(-5deg)}66%{transform:rotate(6deg)}82%{transform:rotate(-3deg)}93%{transform:rotate(3deg)}}
@keyframes hopOutArmA{0%{transform:rotate(0)}18%{transform:rotate(130deg)}34%,38%{transform:rotate(20deg)}56%{transform:rotate(150deg)}72%,76%{transform:rotate(25deg)}100%{transform:rotate(160deg)}}
@keyframes hopOutArmB{0%{transform:rotate(0)}18%{transform:rotate(-130deg)}34%,38%{transform:rotate(-20deg)}56%{transform:rotate(-150deg)}72%,76%{transform:rotate(-25deg)}100%{transform:rotate(-160deg)}}
@keyframes hopOutLegA{0%,34%,38%,72%,76%{transform:rotate(0)}18%{transform:rotate(20deg)}56%{transform:rotate(28deg)}100%{transform:rotate(32deg)}}
@keyframes hopOutLegB{0%,34%,38%,72%,76%{transform:rotate(0)}18%{transform:rotate(-20deg)}56%{transform:rotate(-28deg)}100%{transform:rotate(-32deg)}}

/* fall */
@keyframes fallIn{0%{transform:translateY(-360px) rotate(-9deg)}30%{transform:translateY(-225px) rotate(8deg)}58%{transform:translateY(-100px) rotate(-6deg)}84%{transform:translateY(0) rotate(0)}100%{transform:translateY(0) rotate(0)}}
@keyframes land{0%,83%{transform:scale(1,1)}89%{transform:scale(1.14,.82)}95%{transform:scale(.97,1.04)}100%{transform:scale(1,1)}}
@keyframes fallArmA{0%{transform:rotate(150deg)}15%{transform:rotate(172deg)}30%{transform:rotate(138deg)}45%{transform:rotate(172deg)}60%{transform:rotate(140deg)}75%{transform:rotate(170deg)}84%{transform:rotate(150deg)}90%{transform:rotate(55deg)}100%{transform:rotate(0)}}
@keyframes fallArmB{0%{transform:rotate(-150deg)}15%{transform:rotate(-138deg)}30%{transform:rotate(-172deg)}45%{transform:rotate(-140deg)}60%{transform:rotate(-172deg)}75%{transform:rotate(-142deg)}84%{transform:rotate(-150deg)}90%{transform:rotate(-55deg)}100%{transform:rotate(0)}}
@keyframes fallLegA{0%{transform:rotate(16deg)}20%{transform:rotate(-16deg)}40%{transform:rotate(16deg)}60%{transform:rotate(-16deg)}80%{transform:rotate(10deg)}84%{transform:rotate(0)}89%{transform:rotate(24deg)}100%{transform:rotate(0)}}
@keyframes fallLegB{0%{transform:rotate(-16deg)}20%{transform:rotate(16deg)}40%{transform:rotate(-16deg)}60%{transform:rotate(16deg)}80%{transform:rotate(-10deg)}84%{transform:rotate(0)}89%{transform:rotate(-24deg)}100%{transform:rotate(0)}}
@keyframes fallHead{0%,80%{transform:rotate(-5deg)}89%{transform:rotate(9deg)}100%{transform:rotate(0)}}
@keyframes wideFall{0%,84%{transform:scale(1.35)}92%{transform:scale(1,.2)}100%{transform:scale(1)}}

/* sprout / burrow */
@keyframes rise{0%,12%{transform:translateY(${DEPTH}px)}22%,34%{transform:translateY(152px)}48%{transform:translateY(95px)}54%{transform:translateY(102px)}70%{transform:translateY(40px)}76%{transform:translateY(47px)}91%{transform:translateY(-10px)}100%{transform:translateY(0)}}
@keyframes sink{0%,20%{transform:translateY(0)}35%{transform:translateY(62px)}42%{transform:translateY(55px)}60%{transform:translateY(124px)}66%{transform:translateY(117px)}88%,100%{transform:translateY(${DEPTH}px)}}
@keyframes wiggle{from{transform:rotate(-3.5deg)}to{transform:rotate(3.5deg)}}
@keyframes pushA{0%,12%{transform:rotate(0)}22%,34%{transform:rotate(150deg)}48%{transform:rotate(172deg)}54%{transform:rotate(140deg)}70%{transform:rotate(172deg)}76%{transform:rotate(140deg)}91%{transform:rotate(175deg)}100%{transform:rotate(0)}}
@keyframes pushB{0%,12%{transform:rotate(0)}22%,34%{transform:rotate(-150deg)}48%{transform:rotate(-172deg)}54%{transform:rotate(-140deg)}70%{transform:rotate(-172deg)}76%{transform:rotate(-140deg)}91%{transform:rotate(-175deg)}100%{transform:rotate(0)}}
@keyframes kickA{0%,70%{transform:rotate(0)}80%{transform:rotate(22deg)}91%{transform:rotate(-12deg)}100%{transform:rotate(0)}}
@keyframes kickB{0%,70%{transform:rotate(0)}80%{transform:rotate(-22deg)}91%{transform:rotate(12deg)}100%{transform:rotate(0)}}
@keyframes shake{from{transform:rotate(-8deg)}to{transform:rotate(8deg)}}
@keyframes digA{0%,18%{transform:rotate(0)}28%,100%{transform:rotate(158deg)}}
@keyframes digB{0%{transform:rotate(0)}4%{transform:rotate(-155deg)}8%{transform:rotate(-115deg)}12%{transform:rotate(-155deg)}16%{transform:rotate(-115deg)}22%,100%{transform:rotate(-158deg)}}
@keyframes crack{from{stroke-dashoffset:80}to{stroke-dashoffset:0}}
@keyframes moundUp{0%{transform:scaleY(0)}12%,86%{transform:scaleY(1)}100%{transform:scaleY(.35)}}
@keyframes fling{0%{transform:translate(0,0);opacity:0}8%{opacity:1}55%{transform:translate(calc(var(--dx)*.6),var(--dy));opacity:1}100%{transform:translate(var(--dx),8px);opacity:0}}
@keyframes leafOff{to{transform:translate(-16px,-36px) rotate(-55deg);opacity:0}}

/* roll = tumbles in curled up like a ball, pops up dizzy */
@keyframes rollIn{0%{transform:translateX(${OFF}px);animation-timing-function:cubic-bezier(.2,.5,.3,1)}68%{transform:translateX(14px)}84%{transform:translateX(-4px)}100%{transform:translateX(0)}}
@keyframes rollSpin{0%{transform:rotate(-360deg);animation-timing-function:cubic-bezier(.2,.5,.3,1)}68%{transform:rotate(0deg)}76%{transform:rotate(9deg)}86%{transform:rotate(-6deg)}94%{transform:rotate(3deg)}100%{transform:rotate(0deg)}}
@keyframes rollLegA{0%,56%{transform:rotate(-72deg)}72%{transform:rotate(12deg)}100%{transform:rotate(0)}}
@keyframes rollLegB{0%,56%{transform:rotate(-98deg)}72%{transform:rotate(-10deg)}100%{transform:rotate(0)}}
@keyframes rollArmA{0%,56%{transform:rotate(-55deg)}72%{transform:rotate(125deg)}86%{transform:rotate(60deg)}100%{transform:rotate(0)}}
@keyframes rollArmB{0%,56%{transform:rotate(-62deg)}72%{transform:rotate(-125deg)}86%{transform:rotate(-50deg)}100%{transform:rotate(0)}}
@keyframes rollHead{0%,56%{transform:rotate(24deg)}72%{transform:rotate(-9deg)}84%{transform:rotate(7deg)}100%{transform:rotate(0)}}
@keyframes rollOut{0%,20%{transform:translateX(0);animation-timing-function:cubic-bezier(.5,0,.8,.5)}100%{transform:translateX(${OFF - 40}px)}}
@keyframes rollSpinOut{0%,20%{transform:rotate(0deg);animation-timing-function:cubic-bezier(.5,0,.8,.5)}100%{transform:rotate(-400deg)}}
@keyframes curlLegA{0%{transform:rotate(0)}20%,100%{transform:rotate(-72deg)}}
@keyframes curlLegB{0%{transform:rotate(0)}20%,100%{transform:rotate(-98deg)}}
@keyframes curlArmA{0%{transform:rotate(0)}20%,100%{transform:rotate(-55deg)}}
@keyframes curlArmB{0%{transform:rotate(0)}20%,100%{transform:rotate(-62deg)}}
@keyframes curlHead{0%{transform:rotate(0)}20%,100%{transform:rotate(24deg)}}
@keyframes orbit{to{transform:rotate(360deg)}}
@keyframes starsIn{0%{opacity:0}15%,75%{opacity:1}100%{opacity:0}}

/* balloon = floats down holding a balloon; float = leaves the same way */
@keyframes floatY{0%{transform:translateY(-360px) rotate(7deg)}25%{transform:translateY(-260px) rotate(-6deg)}50%{transform:translateY(-160px) rotate(6deg)}75%{transform:translateY(-60px) rotate(-3deg)}90%,100%{transform:translateY(0) rotate(0deg)}}
@keyframes floatX{0%{transform:translateX(30px)}25%{transform:translateX(-14px)}50%{transform:translateX(16px)}75%{transform:translateX(-6px)}90%,100%{transform:translateX(0)}}
@keyframes landSoft{0%,88%{transform:scale(1,1)}93%{transform:scale(1.08,.9)}100%{transform:scale(1,1)}}
@keyframes holdUp{0%,90%{transform:rotate(165deg)}100%{transform:rotate(0)}}
@keyframes hangB{0%{transform:rotate(-30deg)}25%{transform:rotate(-12deg)}50%{transform:rotate(-30deg)}75%{transform:rotate(-14deg)}90%,100%{transform:rotate(0)}}
@keyframes dangleA{0%{transform:rotate(12deg)}25%{transform:rotate(-10deg)}50%{transform:rotate(12deg)}75%{transform:rotate(-8deg)}90%,100%{transform:rotate(0)}}
@keyframes dangleB{0%{transform:rotate(-10deg)}25%{transform:rotate(12deg)}50%{transform:rotate(-10deg)}75%{transform:rotate(10deg)}90%,100%{transform:rotate(0)}}
@keyframes balloonAway{to{transform:translate(70px,-340px);opacity:0}}
@keyframes inflate{from{transform:scale(0)}to{transform:scale(1)}}
@keyframes floatOutY{0%,24%{transform:translateY(0) rotate(0deg)}40%{transform:translateY(-50px) rotate(-5deg)}60%{transform:translateY(-150px) rotate(5deg)}80%{transform:translateY(-270px) rotate(-4deg)}100%{transform:translateY(-410px) rotate(4deg)}}
@keyframes floatOutX{0%,24%{transform:translateX(0)}45%{transform:translateX(-16px)}70%{transform:translateX(10px)}100%{transform:translateX(-30px)}}
@keyframes holdUpOut{0%{transform:rotate(0)}12%,100%{transform:rotate(165deg)}}
@keyframes dangleOutA{0%,24%{transform:rotate(0)}40%{transform:rotate(12deg)}60%{transform:rotate(-10deg)}80%{transform:rotate(12deg)}100%{transform:rotate(-8deg)}}
@keyframes dangleOutB{0%,24%{transform:rotate(0)}40%{transform:rotate(-10deg)}60%{transform:rotate(12deg)}80%{transform:rotate(-10deg)}100%{transform:rotate(10deg)}}

/* faraway = runs in from the distance (depth) and back out */
@keyframes depthIn{0%{transform:translate(120px,-78px) scale(.1);opacity:0}6%{opacity:1}20%{transform:translate(109px,-71px) scale(.18)}40%{transform:translate(93px,-61px) scale(.3)}60%{transform:translate(69px,-45px) scale(.48)}80%{transform:translate(37px,-24px) scale(.72)}100%{transform:translate(0,0) scale(1);opacity:1}}
@keyframes depthOut{0%{transform:translate(0,0) scale(1);opacity:1}20%{transform:translate(37px,-24px) scale(.72)}40%{transform:translate(69px,-45px) scale(.48)}60%{transform:translate(93px,-61px) scale(.3)}80%{transform:translate(109px,-71px) scale(.18);opacity:1}100%{transform:translate(120px,-78px) scale(.1);opacity:0}}
@keyframes skid{0%{transform:rotate(0)}35%{transform:rotate(-8deg)}70%{transform:rotate(4deg)}100%{transform:rotate(0)}}

/* poof = appears in a puff of smoke with a spin */
@keyframes poofIn{0%,14%{transform:rotateY(-540deg) scale(0,0)}62%{transform:rotateY(-30deg) scale(1.14,1.14)}80%{transform:rotateY(0deg) scale(.95,.95)}100%{transform:rotateY(0deg) scale(1,1)}}
@keyframes poofOut{0%{transform:rotateY(0deg) scale(1,1)}22%{transform:rotateY(0deg) scale(1.1,.9)}100%{transform:rotateY(720deg) scale(0,0)}}
@keyframes tadaA{0%,45%{transform:rotate(0)}66%{transform:rotate(128deg)}84%{transform:rotate(112deg)}100%{transform:rotate(0)}}
@keyframes tadaB{0%,45%{transform:rotate(0)}66%{transform:rotate(-128deg)}84%{transform:rotate(-112deg)}100%{transform:rotate(0)}}

/* peek = peeks round the edge twice, then hops in */
@keyframes peekX{0%{transform:translateX(${OFF}px)}12%,24%{transform:translateX(-94px)}32%,38%{transform:translateX(${OFF}px)}48%,72%{transform:translateX(-72px)}100%{transform:translateX(0)}}
@keyframes peekBob{0%{transform:rotate(0deg) translateY(0) scale(1,1)}12%,24%{transform:rotate(18deg) translateY(0) scale(1,1)}32%,38%{transform:rotate(0deg) translateY(0) scale(1,1)}48%,66%{transform:rotate(21deg) translateY(0) scale(1,1)}72%{transform:rotate(0deg) translateY(0) scale(1.08,.9)}86%{transform:rotate(0deg) translateY(-50px) scale(.97,1.04)}96%{transform:rotate(0deg) translateY(0) scale(1.1,.88)}100%{transform:rotate(0deg) translateY(0) scale(1,1)}}
@keyframes peekLookF{0%,48%{transform:translateX(0)}53%{transform:translateX(6px)}60%{transform:translateX(-5px)}66%,100%{transform:translateX(0)}}
@keyframes peekLookB{0%,48%{transform:translateX(0)}53%{transform:translateX(-3.5px)}60%{transform:translateX(3px)}66%,100%{transform:translateX(0)}}
@keyframes peekEyes{0%,10%{transform:scale(1)}14%,24%{transform:scale(1.35)}30%,46%{transform:scale(1)}50%,64%{transform:scale(1.35)}70%,100%{transform:scale(1)}}
@keyframes peekArmA{0%,72%{transform:rotate(0)}86%{transform:rotate(150deg)}100%{transform:rotate(0)}}
@keyframes peekArmB{0%,72%{transform:rotate(0)}86%{transform:rotate(-150deg)}100%{transform:rotate(0)}}`;

type Layer = 'mx' | 'my' | 'bob' | 'face' | 'leg-a' | 'leg-b' | 'arm-a' | 'arm-b' | 'head' | 'pf' | 'pb' | 'eyes' | 'ear'
  | 'shs' | 'bubble' | 'mound' | 'cracks' | 'crack' | 'leaf' | 'lines' | 'balloon' | 'stars' | 'orbit';

export function buildStageSvg(o: StageOptions): string {
  const t = timings(o.entry, o.exit, o.speed);
  const k = t.k;
  const scale = SIZE[o.size];
  const happy = o.phase === 'ack';
  const anim: Partial<Record<Layer, string[]>> = {};
  const add = (l: Layer, a: string) => (anim[l] ??= []).push(a);
  const rules: string[] = [];
  const fxGround: string[] = []; // on the ground, travels sideways with the character (dust, speed lines)
  const fxAir: string[] = [];    // behind the character, also follows it up and down (balloon)
  const fxTop: string[] = [];    // in front of the character (dizzy stars, sweat)
  const overlay: string[] = [];  // fixed on the stage, in front of everything (smoke, sparkles)
  const ms = (n: number) => `${Math.round(n)}ms`;

  /** Whole-body pose animation: one keyframes set per body part, same duration. */
  const pose = (parts: Partial<Record<Layer, string>>, dur: number, delay: number, fill = 'both', ease = 'ease-in-out') => {
    for (const [layer, name] of Object.entries(parts)) add(layer as Layer, `${name} ${ms(dur)} ${ease} ${ms(delay)} ${fill}`);
  };
  const puff = (x: number, dx: number, at: number, dy = -10) =>
    fxGround.push(`<circle class="puff" cx="${x}" cy="-5" r="7" fill="#B8BEC9" style="--px:${dx}px;--py:${dy}px;animation:puff ${ms(600 * k)} ease-out ${ms(at)} both"/>`);
  const flutter = (dur: number, delay: number) => {
    const n = Math.max(2, Math.round(dur / (180 * k)));
    add('ear', `flutter ${ms(dur / n)} ease-in-out ${ms(delay)} ${n} alternate`);
  };
  /** Walking (cadence 440) or running (cadence ~250) limb cycle. */
  const stepCycle = (dur: number, delay: number, cadence = 440) => {
    const n = Math.max(2, Math.round(dur / (cadence * k)));
    const c = dur / n;
    add('bob', `bob ${ms(c / 2)} ease-in-out ${ms(delay)} ${n * 2} alternate`);
    add('leg-a', `stepA ${ms(c)} linear ${ms(delay)} ${n}`);
    add('leg-b', `stepB ${ms(c)} linear ${ms(delay)} ${n}`);
    add('arm-a', `stepB ${ms(c)} linear ${ms(delay)} ${n}`);
    add('arm-b', `stepA ${ms(c)} linear ${ms(delay)} ${n}`);
    add('head', `sway ${ms(c)} linear ${ms(delay)} ${n}`);
    flutter(dur, delay);
  };
  /** Gentle "alive" loops. Finite on purpose: a waiting character must not animate forever. */
  const idle = (start: number, total: number, talk: boolean) => {
    const n = (period: number) => Math.max(1, Math.floor(total / period));
    add('bob', `breathe 2600ms ease-in-out ${ms(start)} ${n(2600)}`);
    add('arm-b', `hold 2400ms ease-in-out ${ms(start + 750)} ${n(2400)}`);
    if (talk) add('head', `nod 520ms ease-in-out ${ms(start + 700)} 3`);
    add('pf', `lookF 6000ms ease-in-out ${ms(start + 2600)} ${n(6000)}`);
    add('pb', `lookB 6000ms ease-in-out ${ms(start + 2600)} ${n(6000)}`);
    add('eyes', `blink 4s linear ${ms(start + 800)} ${n(4000)}`);
    add('ear', `flap 3.4s ease-in-out ${ms(start + 600)} ${n(3400)}`);
  };
  const balloon = () => fxAir.push(`<g class="balloon"><path d="M-40,-103 q-10,-36 -6,-74" fill="none" stroke="#9AA6B8" stroke-width="1.5"/>
    <ellipse cx="-46" cy="-205" rx="24" ry="29" fill="#E2574C"/><path d="M-50,-177 l4,7 l4,-7z" fill="#C4443A"/>
    <ellipse cx="-55" cy="-217" rx="6" ry="9" fill="#fff" opacity=".45" transform="rotate(-20 -55 -217)"/></g>`);
  const smoke = (at: number) => {
    const cx = REST_X, cy = G - 72;
    const dirs = [[-58, -30], [58, -34], [-40, 26], [44, 22], [0, -62], [-70, 4], [72, 0], [6, 36]];
    dirs.forEach(([dx, dy], i) => overlay.push(
      `<circle class="puff" cx="${cx + dx * 0.15}" cy="${cy + dy * 0.15}" r="${18 + (i % 3) * 4}" fill="#DCE1EA" style="--px:${dx}px;--py:${dy}px;animation:smoke ${ms(850 * k)} ease-out ${ms(at + i * 30 * k)} both"/>`));
    [[-52, -96], [56, -84], [-64, -24], [60, -10], [4, -128]].forEach(([dx, dy], i) => overlay.push(
      `<path class="spark" d="${star(cx + dx, cy + 40 + dy, 9)}" fill="#FFD54A" style="animation:twinkle ${ms(700 * k)} ease-out ${ms(at + 120 * k + i * 90 * k)} both"/>`));
  };

  let ground = false;           // draw mound + cracks?
  let clodTimes: number[] = []; // when dirt flies (ms)

  if (o.phase === 'enter') {
    const E = t.enterMs;
    switch (o.entry) {
      case 'walk':
        add('mx', `inX ${ms(E)} cubic-bezier(.25,.4,.45,1) both`);
        stepCycle(E, 0);
        break;
      case 'slide': // slips in, flails, nearly falls over, recovers
        add('mx', `slipIn ${ms(E)} ease-out both`);
        pose({ bob: 'slipTilt', 'leg-a': 'slipLegA', 'leg-b': 'slipLegB', 'arm-a': 'slipArmA', 'arm-b': 'slipArmB', head: 'slipHead', eyes: 'wide' }, E, 0);
        add('lines', `lines ${ms(E)} linear both`);
        fxGround.push(`<g class="lines" stroke="#B8BEC9" stroke-width="3" stroke-linecap="round"><path d="M-62,-104 h-46 M-70,-72 h-58 M-58,-38 h-40"/></g>`);
        [0.04, 0.14, 0.24, 0.34, 0.44].forEach((f) => puff(-14, -48, f * E));
        fxTop.push(`<path class="sweat" d="M40,-150 q6,9 0,13 q-6,-4 0,-13z" fill="#5BB8E8" style="animation:sweat ${ms(700 * k)} ease-out ${ms(E * 0.7)} both"/>`);
        flutter(E * 0.75, 0);
        break;
      case 'bounce':
        add('mx', `inX ${ms(E)} linear both`);
        pose({ bob: 'hopsIn', 'arm-a': 'hopArmA', 'arm-b': 'hopArmB', 'leg-a': 'hopLegA', 'leg-b': 'hopLegB', head: 'hopHead', shs: 'shHopsIn' }, E, 0, 'both', 'linear');
        [0.33, 0.66, 0.93].forEach((f) => { puff(-16, -26, f * E); puff(16, 26, f * E); });
        flutter(E, 0);
        break;
      case 'fall':
        add('my', `fallIn ${ms(E)} ease-in-out both`);
        pose({ bob: 'land', 'arm-a': 'fallArmA', 'arm-b': 'fallArmB', 'leg-a': 'fallLegA', 'leg-b': 'fallLegB', head: 'fallHead', eyes: 'wideFall' }, E, 0);
        add('shs', `shFall ${ms(E)} ease-in both`);
        puff(-18, -34, 0.84 * E); puff(18, 34, 0.84 * E); puff(-8, -20, 0.86 * E, -18); puff(8, 20, 0.86 * E, -18);
        flutter(E * 0.84, 0);
        break;
      case 'sprout':
        ground = true;
        add('my', `rise ${ms(E)} cubic-bezier(.3,.1,.3,1) both`);
        add('bob', `wiggle ${ms((E * 0.76) / 8)} ease-in-out ${ms(E * 0.12)} 8 alternate`);
        pose({ 'arm-a': 'pushA', 'arm-b': 'pushB', 'leg-a': 'kickA', 'leg-b': 'kickB' }, E, 0);
        add('head', `shake ${ms(110 * k)} ease-in-out ${ms(E)} 6 alternate`); // shakes the dirt off
        add('shs', `shLate ${ms(E)} linear both`);
        add('mound', `moundUp ${ms(E)} ease-out both`);
        add('crack', `crack ${ms(E * 0.14)} ease-out both`);
        add('leaf', `leafOff ${ms(500 * k)} ease-in ${ms(E + 150)} forwards`);
        clodTimes = [0.03, 0.14, 0.2, 0.44, 0.47, 0.66, 0.69, 0.86, 0.88, 0.9].map((f) => f * E);
        flutter(E * 0.8, E * 0.2);
        break;
      case 'roll': // tumbles in curled up, pops upright and sees stars
        rules.push('.bob{transform-origin:0px -78px}');
        add('mx', `rollIn ${ms(E)} linear both`);
        pose({ bob: 'rollSpin', 'leg-a': 'rollLegA', 'leg-b': 'rollLegB', 'arm-a': 'rollArmA', 'arm-b': 'rollArmB', head: 'rollHead' }, E, 0, 'both', 'ease-out');
        [0.1, 0.25, 0.4, 0.55].forEach((f) => puff(-20, -40, f * E));
        fxTop.push(`<g class="stars" transform="translate(2,-160) scale(1,.38)"><g class="orbit">${[0, 120, 240].map((a) =>
          `<path d="${star(27 * Math.cos((a * Math.PI) / 180), 27 * Math.sin((a * Math.PI) / 180), 8)}" fill="#FFD54A"/>`).join('')}</g></g>`);
        rules.push('.stars{opacity:0}');
        add('stars', `starsIn ${ms(1900 * k)} linear ${ms(E * 0.66)} both`);
        add('orbit', `orbit ${ms(650 * k)} linear ${ms(E * 0.66)} 3`);
        flutter(E * 0.7, 0);
        break;
      case 'balloon': // drifts down under a balloon, lands, lets it go
        rules.push('.my{transform-origin:-46px -205px}');
        balloon();
        add('mx', `floatX ${ms(E)} ease-in-out both`);
        add('my', `floatY ${ms(E)} linear both`);
        pose({ bob: 'landSoft', 'arm-a': 'holdUp', 'arm-b': 'hangB', 'leg-a': 'dangleA', 'leg-b': 'dangleB', shs: 'shFloat' }, E, 0);
        add('balloon', `balloonAway ${ms(1700 * k)} ease-in ${ms(E * 0.9)} forwards`);
        puff(-16, -24, 0.9 * E); puff(16, 24, 0.9 * E);
        flutter(E * 0.9, 0);
        break;
      case 'faraway': // runs in from the distance, growing as it gets closer
        add('mx', `depthIn ${ms(E)} linear both`);
        stepCycle(E * 0.88, 0, 250);
        add('bob', `skid ${ms(E * 0.24)} ease-out ${ms(E * 0.84)}`);
        [0.3, 0.5, 0.68, 0.84, 0.96].forEach((f) => puff(-14, -30, f * E));
        break;
      case 'poof': // appears out of a puff of smoke with a spin
        pose({ bob: 'poofIn', 'arm-a': 'tadaA', 'arm-b': 'tadaB' }, E, 0, 'both', 'ease-out');
        add('shs', `shFadeIn ${ms(E * 0.3)} linear ${ms(E * 0.25)} both`);
        smoke(0);
        flutter(E * 0.7, E * 0.15);
        break;
      case 'peek': // peeks round the edge twice, then hops in
        add('mx', `peekX ${ms(E)} ease-in-out both`);
        pose({ bob: 'peekBob', pf: 'peekLookF', pb: 'peekLookB', eyes: 'peekEyes', 'arm-a': 'peekArmA', 'arm-b': 'peekArmB' }, E, 0);
        add('shs', `shPeek ${ms(E)} linear both`);
        puff(-16, -26, 0.96 * E); puff(16, 26, 0.96 * E);
        flutter(E * 0.3, E * 0.7);
        break;
    }
    // Arrived: offer the glass, talk, then idle for a while.
    add('arm-b', `offer 500ms ease-out ${ms(E + 250)} forwards`);
    add('bubble', `pop 380ms cubic-bezier(.34,1.56,.64,1) ${ms(E - 100)} both`);
    idle(E, IDLE_MS, true);
  } else if (o.phase === 'wait') {
    // Standing in the rest pose; one short nudge to get noticed, a little idling, then still.
    rules.push('.arm-b{transform:rotate(-105deg)}');
    const at = 150;
    switch (Math.abs(o.nudge ?? 0) % NUDGE_COUNT) {
      case 0: // little hops with a wave
        add('bob', `hop 260ms ease-out ${at}ms 4 alternate`);
        add('shs', `shHop 260ms ease-out ${at}ms 4 alternate`);
        add('arm-a', `cheerA 520ms ease-in-out ${at}ms 2`);
        break;
      case 1: // rattles the glass
        add('arm-b', `shakeB 1500ms ease-in-out ${at}ms 1`);
        add('head', `nod 500ms ease-in-out ${at}ms 3`);
        break;
      case 2: // looks around, taps a foot
        add('pf', `lookF 2400ms ease-in-out ${at}ms 1`);
        add('pb', `lookB 2400ms ease-in-out ${at}ms 1`);
        add('leg-b', `tap 240ms ease-in-out ${at}ms 8`);
        flutter(2000, at);
        break;
      case 3: // twirl
        add('bob', `spinHop 1000ms ease-in-out ${at}ms 1`);
        add('shs', `shHop 500ms ease-out ${at}ms 2 alternate`);
        add('arm-a', `cheerA 500ms ease-in-out ${at}ms 2`);
        break;
      default: // two big jumps
        add('bob', `jump 320ms ease-out ${at}ms 4 alternate`);
        add('shs', `shHop 320ms ease-out ${at}ms 4 alternate`);
        add('arm-a', `cheerA 640ms ease-in-out ${at}ms 2`);
        flutter(1280, at);
        break;
    }
    add('bubble', `pulse 420ms ease-in-out ${at + 100}ms 2`);
    idle(NUDGE_MS, NUDGE_IDLE_MS, false);
    if (o.entry === 'sprout') { ground = true; rules.push('.mound{transform:scaleY(.35)}'); }
  } else {
    const D = happy ? t.happyMs : 0;
    const X = t.exitMs;
    if (happy) {
      add('bob', `hop ${ms(D / 8)} ease-out 0s 8 alternate`);
      add('shs', `shHop ${ms(D / 8)} ease-out 0s 8 alternate`);
      add('arm-a', `cheerA ${ms(D / 4)} ease-in-out 0s 4`);
      add('arm-b', `cheerB ${ms(D / 4)} ease-in-out 0s 4`);
      flutter(D, 0);
    } else {
      add('arm-b', 'lower 240ms ease-out 0s both'); // puts the glass down smoothly
    }
    // Walk, bounce and faraway: wave goodbye first, then turn around and go.
    const turns = t.exit === 'walk' || t.exit === 'bounce' || t.exit === 'faraway';
    const Wv = turns ? X * 0.24 : 0;
    const T = Math.min(260 * k, Wv * 0.45);
    if (turns) {
      add('arm-b', `waveB ${ms((Wv - T) / 2)} ease-in-out ${ms(D)} 2`);
      add('head', `nod ${ms((Wv - T) / 2)} ease-in-out ${ms(D)} 2`);
      add('face', `turn ${ms(T)} ease-in-out ${ms(D + Wv - T)} forwards`);
    }
    switch (t.exit) {
      case 'walk':
        add('mx', `outX ${ms(X - Wv)} cubic-bezier(.55,0,.75,.6) ${ms(D + Wv)} forwards`);
        stepCycle(X - Wv, D + Wv);
        break;
      case 'slide': // feet shoot out from under it and it slides away backwards
        add('mx', `slipOut ${ms(X)} linear ${ms(D)} forwards`);
        pose({ bob: 'slipOutTilt', 'leg-a': 'slipOutLegA', 'leg-b': 'slipOutLegB', 'arm-a': 'slipOutArmA', 'arm-b': 'slipOutArmB', eyes: 'wideOut' }, X, D, 'forwards');
        add('lines', `linesOut ${ms(X)} linear ${ms(D)} both`);
        fxGround.push(`<g class="lines" stroke="#B8BEC9" stroke-width="3" stroke-linecap="round"><path d="M64,-104 h44 M72,-72 h56 M60,-38 h40"/></g>`);
        [0.2, 0.35, 0.5, 0.65, 0.8].forEach((f) => puff(30, 46, D + f * X));
        flutter(X, D);
        break;
      case 'bounce':
        add('mx', `outX ${ms(X - Wv)} linear ${ms(D + Wv)} forwards`);
        pose({ bob: 'hopsOut', 'arm-a': 'hopOutArmA', 'arm-b': 'hopOutArmB', 'leg-a': 'hopOutLegA', 'leg-b': 'hopOutLegB', shs: 'shHopsOut' }, X - Wv, D + Wv, 'forwards', 'linear');
        [0.34, 0.72].forEach((f) => { puff(-16, -26, D + Wv + f * (X - Wv)); puff(16, 26, D + Wv + f * (X - Wv)); });
        flutter(X - Wv, D + Wv);
        break;
      case 'burrow': // waves, then digs back down
        ground = true;
        add('my', `sink ${ms(X)} cubic-bezier(.4,0,.6,1) ${ms(D)} forwards`);
        add('bob', `wiggle ${ms((X * 0.7) / 8)} ease-in-out ${ms(D + X * 0.18)} 8 alternate`);
        pose({ 'arm-a': 'digA', 'arm-b': 'digB' }, X, D, 'forwards');
        add('shs', `shFadeOut ${ms(X * 0.2)} linear ${ms(D + X * 0.1)} forwards`);
        clodTimes = [0.05, 0.12, 0.3, 0.33, 0.55, 0.58, 0.8, 0.84].map((f) => D + f * X);
        flutter(X * 0.7, D + X * 0.18);
        break;
      case 'roll': // curls up and rolls away
        rules.push('.bob{transform-origin:0px -78px}');
        add('mx', `rollOut ${ms(X)} linear ${ms(D)} forwards`);
        pose({ bob: 'rollSpinOut', 'leg-a': 'curlLegA', 'leg-b': 'curlLegB', 'arm-a': 'curlArmA', 'arm-b': 'curlArmB', head: 'curlHead' }, X, D, 'forwards', 'ease-out');
        [0.35, 0.5, 0.65, 0.8].forEach((f) => puff(20, 40, D + f * X));
        flutter(X, D);
        break;
      case 'float': // blows up a balloon and drifts away
        rules.push('.my{transform-origin:-46px -205px}');
        balloon();
        add('balloon', `inflate ${ms(X * 0.2)} cubic-bezier(.34,1.56,.64,1) ${ms(D + X * 0.04)} both`);
        add('mx', `floatOutX ${ms(X)} ease-in-out ${ms(D)} forwards`);
        add('my', `floatOutY ${ms(X)} linear ${ms(D)} forwards`);
        pose({ 'arm-a': 'holdUpOut', 'leg-a': 'dangleOutA', 'leg-b': 'dangleOutB', shs: 'shFloatOut' }, X, D, 'forwards');
        add('arm-b', `waveB ${ms(X * 0.14)} ease-in-out ${ms(D + X * 0.3)} 4`);
        flutter(X * 0.7, D + X * 0.24);
        break;
      case 'faraway': // turns and runs off into the distance
        add('mx', `depthOut ${ms(X - Wv)} linear ${ms(D + Wv)} forwards`);
        stepCycle(X - Wv, D + Wv, 250);
        [0.05, 0.2, 0.36].forEach((f) => puff(14, 30, D + Wv + f * (X - Wv)));
        break;
      case 'poof': // spins and vanishes in a puff of smoke
        pose({ bob: 'poofOut' }, X, D, 'forwards', 'ease-in');
        add('shs', `shFadeOut ${ms(X * 0.3)} linear ${ms(D + X * 0.5)} forwards`);
        smoke(D + X * 0.5);
        flutter(X, D);
        break;
    }
    add('bubble', `fade 250ms ease-in ${ms(happy ? D - 300 : 0)} forwards`);

    // Ground left over from a sprout entry, or needed for a burrow exit.
    const start = o.entry === 'sprout' ? 0.35 : 0;
    if (t.exit === 'burrow') {
      rules.push(`@keyframes moundDown{0%{transform:scaleY(${start})}20%,82%{transform:scaleY(1)}100%{transform:scaleY(0)}}`);
      add('mound', `moundDown ${ms(X)} ease-in-out ${ms(D)} both`);
      if (o.entry !== 'sprout') add('crack', `crack ${ms(X * 0.15)} ease-out ${ms(D)} both`);
      add('cracks', `fade 300ms ease-in ${ms(D + X - 300)} forwards`);
    } else if (o.entry === 'sprout') {
      ground = true;
      rules.push('.mound{transform:scaleY(.35)}');
      add('mound', `fade 400ms ease-in ${ms(D)} forwards`);
      add('cracks', `fade 400ms ease-in ${ms(D)} forwards`);
    }
  }

  const css = Object.entries(anim).map(([l, a]) => `.${l}{animation:${a!.join(',')}}`).join('\n');

  // Speech bubble
  const bw = 312, bh = 92, bx = 138, by = G - 202;
  const text = happy ? (o.ackMessage ?? DEFAULT_ACK_MESSAGE) : o.message;
  const lines = wrap(text);
  const ty = by + (happy ? bh / 2 + 5 - (lines.length - 1) * 10 : 30 - (lines.length - 1) * 4);
  const fill = o.dark ? '#252A34' : '#FFFFFF';
  const ink = o.dark ? '#E8ECF3' : '#1F2937';
  const sub = o.dark ? '#9AA6B8' : '#6B7280';
  const stroke = o.dark ? '#5BB8E8' : '#4F7CAC';
  const hint = happy ? '' :
    `<text x="${bx + bw / 2}" y="${by + bh - 10}" text-anchor="middle" font-size="10.5" fill="${sub}">Had a drink? Click 💧 in the status bar</text>`;

  // Ground-break props
  const cx = REST_X;
  const cracks = ground ? `<g class="cracks" fill="none" stroke="#5A3B22" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <path class="crack" stroke-dasharray="80" d="M${cx - 6},${G + 8} l-16,-5 l-14,5 l-18,-4 l-12,4"/>
  <path class="crack" stroke-dasharray="80" d="M${cx + 6},${G + 9} l14,-6 l16,5 l14,-5 l20,3"/>
  <path class="crack" stroke-dasharray="80" d="M${cx},${G + 12} l-5,-6 l7,-5"/>
</g>` : '';
  const mound = ground ? `<g class="mound"><path d="M${cx - 62},${G + 4} q10,-20 30,-18 q8,-10 22,-8 q10,-6 22,2 q16,-2 22,10 q12,2 16,14 z" fill="#8B5E3C"/>
  <path d="M${cx - 40},${G - 6} q8,-6 16,-2 M${cx + 6},${G - 12} q10,-4 18,2" fill="none" stroke="#A9764D" stroke-width="3" stroke-linecap="round"/>
  <circle cx="${cx - 20}" cy="${G - 2}" r="3" fill="#6F4A2E"/><circle cx="${cx + 30}" cy="${G - 1}" r="3.5" fill="#6F4A2E"/></g>` : '';
  const clods = clodTimes.map((at, i) => {
    const dx = (i % 2 ? 1 : -1) * (24 + ((i * 37) % 50));
    const dy = -(34 + ((i * 53) % 44));
    return `<circle class="clod" cx="${cx + (i % 2 ? 14 : -14)}" cy="${G - 12}" r="${2.5 + (i % 3)}" fill="${i % 3 ? '#8B5E3C' : '#6F4A2E'}" style="--dx:${dx}px;--dy:${dy}px;animation:fling ${ms(650 * k)} ease-out ${ms(at)} both"/>`;
  }).join('');

  const body = drawCharacter(getCharacter(o.character), happy, o.phase === 'enter' && o.entry === 'sprout');
  const actor = `<g transform="translate(${REST_X},${G})"><g class="mx"><g class="shs"><ellipse cx="0" cy="3" rx="38" ry="7" fill="url(#gsh)"/></g>${fxGround.join('')}` +
    `<g class="my">${fxAir.join('')}<g class="bob"><g class="face">${body}\n</g></g>${fxTop.join('')}</g></g></g>`;
  // Only ground-break stages are clipped at the ground line (so the character can be "under" it).
  const scene = shade3d(`${ground ? `<g clip-path="url(#above)">${actor}</g>` : actor}\n${mound}\n${clods}\n${overlay.join('')}`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(W * scale)}" height="${Math.round(H * scale)}" viewBox="0 0 ${W} ${H}" data-n="${esc(o.nonce)}">
<style>
.limb{transform-box:fill-box;transform-origin:50% 8%}
.eyes,.puff,.sweat,.spark,.shs{transform-box:fill-box;transform-origin:50% 50%}
.ear{transform-box:fill-box;transform-origin:50% 60%}
.head,.leaf,.mound,.balloon{transform-box:fill-box;transform-origin:50% 100%}
.lines{opacity:0}
.bubble{transform-origin:${bx}px ${by + 70}px}
${KEYFRAMES}
${rules.join('\n')}
${css}
</style>
<defs>
<clipPath id="above"><rect x="-200" y="-600" width="${W + 400}" height="${600 + G + 2}"/></clipPath>
<radialGradient id="hl"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<radialGradient id="chin"><stop offset="0" stop-color="#000" stop-opacity=".3"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<radialGradient id="gsh"><stop offset="0" stop-color="#000" stop-opacity=".42"/><stop offset=".6" stop-color="#000" stop-opacity=".2"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
${scene.defs}
</defs>
<g class="bubble" font-family="-apple-system,'Segoe UI',system-ui,sans-serif">
  <rect x="${bx + 3}" y="${by + 5}" width="${bw}" height="${bh}" rx="16" fill="#000" opacity=".16"/>
  <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="16" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
  <path d="M${bx},${by + 52} l-20,18 l20,-2 z" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>
  <rect x="${bx + 1}" y="${by + 50}" width="6" height="22" fill="${fill}"/>
  ${lines.map((l, i) => `<text x="${bx + bw / 2}" y="${ty + i * 20}" text-anchor="middle" font-size="15" font-weight="600" fill="${ink}">${esc(l)}</text>`).join('\n  ')}
  ${hint}
</g>
${cracks}
${scene.markup}
</svg>`;
}
