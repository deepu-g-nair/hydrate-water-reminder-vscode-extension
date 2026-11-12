/**
 * Character rendering layer + animation engine (pure: no VS Code imports).
 *
 * Builds one self-animating SVG "stage" per phase. Every movement is a CSS
 * animation inside the SVG, so after VS Code paints it the extension host
 * does no per-frame work.
 */
import { getCharacter } from '../characters';
import { drawCharacter } from '../characters/rig';
import { Entry, ExitSetting, Size, SIZE, Speed, timings } from './animations';

export type Phase = 'enter' | 'ack' | 'dismiss';

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
  dark: boolean;
  /** Makes each stage a unique image so its animation timeline starts fresh. */
  nonce: string;
}

const W = 460, H = 244, G = 228; // stage size and ground line
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

const KEYFRAMES = `
@keyframes bob{to{transform:translateY(-4px)}}
@keyframes stepA{0%,100%{transform:rotate(0)}25%{transform:rotate(24deg)}75%{transform:rotate(-24deg)}}
@keyframes stepB{0%,100%{transform:rotate(0)}25%{transform:rotate(-24deg)}75%{transform:rotate(24deg)}}
@keyframes sway{0%,100%{transform:rotate(0)}25%{transform:rotate(3.5deg)}75%{transform:rotate(-3.5deg)}}
@keyframes flutter{to{transform:scaleX(.8)}}
@keyframes breathe{50%{transform:scale(1.012,.985)}}
@keyframes blink{0%,94%,100%{transform:scaleY(1)}97%{transform:scaleY(.1)}}
@keyframes flap{0%,80%,100%{transform:scaleX(1)}90%{transform:scaleX(.88)}}
@keyframes nod{50%{transform:rotate(4deg)}}
@keyframes tilt{0%,100%{transform:rotate(0)}30%{transform:rotate(-3deg)}70%{transform:rotate(3deg)}}
@keyframes pop{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes fade{to{opacity:0}}
@keyframes inX{from{transform:translateX(${OFF}px)}to{transform:translateX(0)}}
@keyframes outX{from{transform:translateX(0)}to{transform:translateX(${OFF}px)}}
@keyframes hop{to{transform:translateY(-20px)}}
@keyframes offer{to{transform:rotate(-105deg)}}
@keyframes hold{0%,100%{transform:rotate(-105deg)}50%{transform:rotate(-94deg)}}
@keyframes cheerA{0%,100%{transform:rotate(150deg)}50%{transform:rotate(168deg)}}
@keyframes cheerB{0%,100%{transform:rotate(-150deg)}50%{transform:rotate(-168deg)}}
@keyframes waveB{0%,100%{transform:rotate(-155deg)}50%{transform:rotate(-112deg)}}
@keyframes turn{to{transform:scaleX(-1)}}
@keyframes wide{0%,62%{transform:scale(1.4)}82%,100%{transform:scale(1)}}
@keyframes wideOut{0%{transform:scale(1)}12%,100%{transform:scale(1.4)}}
@keyframes puff{0%{transform:translate(0,0) scale(.3);opacity:0}12%{opacity:.75}100%{transform:translate(var(--px),var(--py)) scale(1.8);opacity:0}}
@keyframes lines{0%{opacity:0}8%,42%{opacity:.75}60%,100%{opacity:0}}
@keyframes linesOut{0%,15%{opacity:0}30%,100%{opacity:.75}}
@keyframes sweat{0%{transform:translate(0,0);opacity:0}20%{opacity:1}100%{transform:translate(16px,-20px);opacity:0}}

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
@keyframes fallIn{0%{transform:translateY(-330px) rotate(-9deg)}30%{transform:translateY(-205px) rotate(8deg)}58%{transform:translateY(-92px) rotate(-6deg)}84%{transform:translateY(0) rotate(0)}100%{transform:translateY(0) rotate(0)}}
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
@keyframes leafOff{to{transform:translate(-16px,-36px) rotate(-55deg);opacity:0}}`;

type Layer = 'move' | 'bob' | 'face' | 'leg-a' | 'leg-b' | 'arm-a' | 'arm-b' | 'head' | 'eyes' | 'ear' | 'bubble' | 'mound' | 'cracks' | 'crack' | 'leaf' | 'lines';

export function buildStageSvg(o: StageOptions): string {
  const t = timings(o.entry, o.exit, o.speed);
  const scale = SIZE[o.size];
  const happy = o.phase === 'ack';
  const anim: Partial<Record<Layer, string[]>> = {};
  const add = (l: Layer, a: string) => (anim[l] ??= []).push(a);
  const rules: string[] = [];
  const fx: string[] = []; // effects that travel with the character (dust, speed lines)
  const ms = (n: number) => `${Math.round(n)}ms`;

  /** Whole-body pose animation: one keyframes set per body part, same duration. */
  const pose = (parts: Partial<Record<Layer, string>>, dur: number, delay: number, fill = 'both', ease = 'ease-in-out') => {
    for (const [layer, name] of Object.entries(parts)) add(layer as Layer, `${name} ${ms(dur)} ${ease} ${ms(delay)} ${fill}`);
  };
  const puff = (x: number, dx: number, at: number, dy = -10) =>
    fx.push(`<circle class="puff" cx="${x}" cy="-5" r="7" fill="#B8BEC9" style="--px:${dx}px;--py:${dy}px;animation:puff ${ms(600 * t.k)} ease-out ${ms(at)} both"/>`);
  const flutter = (dur: number, delay: number) => {
    const n = Math.max(2, Math.round(dur / (180 * t.k)));
    add('ear', `flutter ${ms(dur / n)} ease-in-out ${ms(delay)} ${n} alternate`);
  };
  const walkCycle = (dur: number, delay: number) => {
    const n = Math.max(2, Math.round(dur / (440 * t.k)));
    const c = dur / n;
    add('bob', `bob ${ms(c / 2)} ease-in-out ${ms(delay)} ${n * 2} alternate`);
    add('leg-a', `stepA ${ms(c)} linear ${ms(delay)} ${n}`);
    add('leg-b', `stepB ${ms(c)} linear ${ms(delay)} ${n}`);
    add('arm-a', `stepB ${ms(c)} linear ${ms(delay)} ${n}`);
    add('arm-b', `stepA ${ms(c)} linear ${ms(delay)} ${n}`);
    add('head', `sway ${ms(c)} linear ${ms(delay)} ${n}`);
    flutter(dur, delay);
  };

  let ground = false;           // draw mound + cracks?
  let clodTimes: number[] = []; // when dirt flies (ms)

  if (o.phase === 'enter') {
    const E = t.enterMs;
    switch (o.entry) {
      case 'walk':
        add('move', `inX ${ms(E)} cubic-bezier(.25,.4,.45,1) both`);
        walkCycle(E, 0);
        break;
      case 'slide': // slips in, flails, nearly falls over, recovers
        add('move', `slipIn ${ms(E)} ease-out both`);
        pose({ bob: 'slipTilt', 'leg-a': 'slipLegA', 'leg-b': 'slipLegB', 'arm-a': 'slipArmA', 'arm-b': 'slipArmB', head: 'slipHead', eyes: 'wide' }, E, 0);
        add('lines', `lines ${ms(E)} linear both`);
        fx.push(`<g class="lines" stroke="#B8BEC9" stroke-width="3" stroke-linecap="round"><path d="M-62,-104 h-46 M-70,-72 h-58 M-58,-38 h-40"/></g>`);
        [0.04, 0.14, 0.24, 0.34, 0.44].forEach((f) => puff(-14, -48, f * E));
        fx.push(`<path class="sweat" d="M40,-150 q6,9 0,13 q-6,-4 0,-13z" fill="#5BB8E8" style="animation:sweat ${ms(700 * t.k)} ease-out ${ms(E * 0.7)} both"/>`);
        flutter(E * 0.75, 0);
        break;
      case 'bounce':
        add('move', `inX ${ms(E)} linear both`);
        pose({ bob: 'hopsIn', 'arm-a': 'hopArmA', 'arm-b': 'hopArmB', 'leg-a': 'hopLegA', 'leg-b': 'hopLegB', head: 'hopHead' }, E, 0, 'both', 'linear');
        [0.33, 0.66, 0.93].forEach((f) => { puff(-16, -26, f * E); puff(16, 26, f * E); });
        flutter(E, 0);
        break;
      case 'fall':
        add('move', `fallIn ${ms(E)} ease-in-out both`);
        pose({ bob: 'land', 'arm-a': 'fallArmA', 'arm-b': 'fallArmB', 'leg-a': 'fallLegA', 'leg-b': 'fallLegB', head: 'fallHead', eyes: 'wideFall' }, E, 0);
        puff(-18, -34, 0.84 * E); puff(18, 34, 0.84 * E); puff(-8, -20, 0.86 * E, -18); puff(8, 20, 0.86 * E, -18);
        flutter(E * 0.84, 0);
        break;
      case 'sprout':
        ground = true;
        add('move', `rise ${ms(E)} cubic-bezier(.3,.1,.3,1) both`);
        add('bob', `wiggle ${ms((E * 0.76) / 8)} ease-in-out ${ms(E * 0.12)} 8 alternate`);
        pose({ 'arm-a': 'pushA', 'arm-b': 'pushB', 'leg-a': 'kickA', 'leg-b': 'kickB' }, E, 0);
        add('head', `shake ${ms(110 * t.k)} ease-in-out ${ms(E)} 6 alternate`); // shakes the dirt off
        add('mound', `moundUp ${ms(E)} ease-out both`);
        add('crack', `crack ${ms(E * 0.14)} ease-out both`);
        add('leaf', `leafOff ${ms(500 * t.k)} ease-in ${ms(E + 150)} forwards`);
        clodTimes = [0.03, 0.14, 0.2, 0.44, 0.47, 0.66, 0.69, 0.86, 0.88, 0.9].map((f) => f * E);
        flutter(E * 0.8, E * 0.2);
        break;
    }
    // Idle + talking
    rules.push('.face{transform:scaleX(1)}');
    add('bob', `breathe 2600ms ease-in-out ${ms(E)} infinite`);
    add('arm-b', `offer 500ms ease-out ${ms(E + 250)} forwards`);
    add('arm-b', `hold 2400ms ease-in-out ${ms(E + 750)} infinite`);
    add('head', `nod 520ms ease-in-out ${ms(E + 700)} 3`);
    add('head', `tilt 5200ms ease-in-out ${ms(E + 2400)} infinite`);
    add('eyes', `blink 4s linear ${ms(E + 800)} infinite`);
    add('ear', `flap 3.4s ease-in-out ${ms(E + 600)} infinite`);
    add('bubble', `pop 380ms cubic-bezier(.34,1.56,.64,1) ${ms(E - 100)} both`);
  } else {
    const D = happy ? t.happyMs : 0;
    const X = t.exitMs;
    rules.push('.face{transform:scaleX(1)}');
    if (happy) {
      add('bob', `hop ${ms(D / 8)} ease-out 0s 8 alternate`);
      add('arm-a', `cheerA ${ms(D / 4)} ease-in-out 0s 4`);
      add('arm-b', `cheerB ${ms(D / 4)} ease-in-out 0s 4`);
      flutter(D, 0);
    }
    const turns = t.exit === 'walk' || t.exit === 'bounce';
    // Walk and bounce: wave goodbye first, then turn around and go.
    const W = turns ? X * 0.24 : 0;
    if (turns) {
      add('arm-b', `waveB ${ms(W / 2)} ease-in-out ${ms(D)} 2`);
      add('head', `nod ${ms(W / 2)} ease-in-out ${ms(D)} 2`);
      add('face', `turn 1ms linear ${ms(D + W)} forwards`);
    }
    switch (t.exit) {
      case 'walk':
        add('move', `outX ${ms(X - W)} cubic-bezier(.55,0,.75,.6) ${ms(D + W)} forwards`);
        walkCycle(X - W, D + W);
        break;
      case 'slide': // feet shoot out from under it and it slides away backwards
        add('move', `slipOut ${ms(X)} linear ${ms(D)} forwards`);
        pose({ bob: 'slipOutTilt', 'leg-a': 'slipOutLegA', 'leg-b': 'slipOutLegB', 'arm-a': 'slipOutArmA', 'arm-b': 'slipOutArmB', eyes: 'wideOut' }, X, D, 'forwards');
        add('lines', `linesOut ${ms(X)} linear ${ms(D)} both`);
        fx.push(`<g class="lines" stroke="#B8BEC9" stroke-width="3" stroke-linecap="round"><path d="M64,-104 h44 M72,-72 h56 M60,-38 h40"/></g>`);
        [0.2, 0.35, 0.5, 0.65, 0.8].forEach((f) => puff(30, 46, D + f * X));
        flutter(X, D);
        break;
      case 'bounce':
        add('move', `outX ${ms(X - W)} linear ${ms(D + W)} forwards`);
        pose({ bob: 'hopsOut', 'arm-a': 'hopOutArmA', 'arm-b': 'hopOutArmB', 'leg-a': 'hopOutLegA', 'leg-b': 'hopOutLegB' }, X - W, D + W, 'forwards', 'linear');
        [0.34, 0.72].forEach((f) => { puff(-16, -26, D + W + f * (X - W)); puff(16, 26, D + W + f * (X - W)); });
        flutter(X - W, D + W);
        break;
      case 'burrow': // waves, then digs back down
        ground = true;
        add('move', `sink ${ms(X)} cubic-bezier(.4,0,.6,1) ${ms(D)} forwards`);
        add('bob', `wiggle ${ms((X * 0.7) / 8)} ease-in-out ${ms(D + X * 0.18)} 8 alternate`);
        pose({ 'arm-a': 'digA', 'arm-b': 'digB' }, X, D, 'forwards');
        clodTimes = [0.05, 0.12, 0.3, 0.33, 0.55, 0.58, 0.8, 0.84].map((f) => D + f * X);
        flutter(X * 0.7, D + X * 0.18);
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
  const bw = 312, bh = 92, bx = 138, by = 26;
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
  const groundSvg = ground ? {
    cracks: `<g class="cracks" fill="none" stroke="#5A3B22" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <path class="crack" stroke-dasharray="80" d="M${cx - 6},${G + 8} l-16,-5 l-14,5 l-18,-4 l-12,4"/>
  <path class="crack" stroke-dasharray="80" d="M${cx + 6},${G + 9} l14,-6 l16,5 l14,-5 l20,3"/>
  <path class="crack" stroke-dasharray="80" d="M${cx},${G + 12} l-5,-6 l7,-5"/>
</g>`,
    mound: `<g class="mound"><path d="M${cx - 62},${G + 4} q10,-20 30,-18 q8,-10 22,-8 q10,-6 22,2 q16,-2 22,10 q12,2 16,14 z" fill="#8B5E3C"/>
  <path d="M${cx - 40},${G - 6} q8,-6 16,-2 M${cx + 6},${G - 12} q10,-4 18,2" fill="none" stroke="#A9764D" stroke-width="3" stroke-linecap="round"/>
  <circle cx="${cx - 20}" cy="${G - 2}" r="3" fill="#6F4A2E"/><circle cx="${cx + 30}" cy="${G - 1}" r="3.5" fill="#6F4A2E"/></g>`,
    clods: clodTimes.map((at, i) => {
      const dx = (i % 2 ? 1 : -1) * (24 + ((i * 37) % 50));
      const dy = -(34 + ((i * 53) % 44));
      const r = 2.5 + (i % 3);
      return `<circle class="clod" cx="${cx + (i % 2 ? 14 : -14)}" cy="${G - 12}" r="${r}" fill="${i % 3 ? '#8B5E3C' : '#6F4A2E'}" style="--dx:${dx}px;--dy:${dy}px;animation:fling ${ms(650 * t.k)} ease-out ${ms(at)} both"/>`;
    }).join(''),
  } : { cracks: '', mound: '', clods: '' };

  const body = drawCharacter(getCharacter(o.character), happy, o.phase === 'enter' && o.entry === 'sprout');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(W * scale)}" height="${Math.round(H * scale)}" viewBox="0 0 ${W} ${H}" data-n="${esc(o.nonce)}">
<style>
.limb{transform-box:fill-box;transform-origin:50% 8%}
.eyes{transform-box:fill-box;transform-origin:50% 50%}
.ear{transform-box:fill-box;transform-origin:50% 60%}
.puff,.sweat{transform-box:fill-box;transform-origin:50% 50%}
.lines{opacity:0}
.head{transform-box:fill-box;transform-origin:50% 100%}
.leaf{transform-box:fill-box;transform-origin:50% 100%}
.mound{transform-box:fill-box;transform-origin:50% 100%}
.bubble{transform-origin:${bx}px ${by + 70}px}
${KEYFRAMES}
${rules.join('\n')}
${css}
</style>
<defs><clipPath id="above"><rect x="-200" y="-600" width="${W + 400}" height="${600 + G + 2}"/></clipPath></defs>
<g class="bubble" font-family="-apple-system,'Segoe UI',system-ui,sans-serif">
  <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="16" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
  <path d="M${bx},${by + 52} l-20,18 l20,-2 z" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>
  <rect x="${bx + 1}" y="${by + 50}" width="6" height="22" fill="${fill}"/>
  ${lines.map((l, i) => `<text x="${bx + bw / 2}" y="${ty + i * 20}" text-anchor="middle" font-size="15" font-weight="600" fill="${ink}">${esc(l)}</text>`).join('\n  ')}
  ${hint}
</g>
${groundSvg.cracks}
<g clip-path="url(#above)"><g transform="translate(${REST_X},${G})"><g class="move">${fx.join('')}<g class="bob"><g class="face">${body}
</g></g></g></g></g>
${groundSvg.mound}
${groundSvg.clods}
</svg>`;
}
