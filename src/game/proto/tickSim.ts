// PROTOTYPE, not used by the game. How expensive is a match simulated in small time steps, with every player and the ball in it?
// It does the kind of work a real engine of that kind would have to do each step (movement towards a place, keeping apart, the ball's
// flight, who gets to the ball, and every so often a decision with passing lanes checked against every defender), so that the time it
// takes is about right. It is not football: the numbers it produces mean nothing, only how long it takes does.
import {Rng} from "../rng";

export interface TickOptions {
  /** Steps per second of match time. */
  hz: number;
  /** Minutes of match time (about 95 with added time). */
  minutes: number;
  /** Twice as much thinking: every player looks at where to run once a second. */
  heavy: boolean;
  seed: number;
  /** Keep every player's and the ball's place (centimetres, 16 bits) for each step. */
  record: boolean;
}

const L = 105;
const W = 68;
const N = 22;
// Where each side's eleven stand (depth 0 = own goal, 1 = the other goal; width across).
const SPOTS: [number, number][] = [
  [0.03, 0.5], [0.25, 0.12], [0.22, 0.38], [0.22, 0.62], [0.25, 0.88],
  [0.5, 0.1], [0.45, 0.38], [0.45, 0.62], [0.5, 0.9], [0.72, 0.4], [0.72, 0.6],
];

export class TickSim {
  readonly dt: number;
  readonly total: number;
  tick = 0;
  readonly goals: [number, number] = [0, 0];
  passes = 0;
  tackles = 0;
  shots = 0;
  /** What was kept: x, y of the 22 and x, y, z of the ball, in centimetres, for each step. */
  readonly track: Int16Array | null;

  private rng: Rng;
  private heavy: boolean;
  private px = new Float64Array(N);
  private py = new Float64Array(N);
  private vx = new Float64Array(N);
  private vy = new Float64Array(N);
  private tx = new Float64Array(N);
  private ty = new Float64Array(N);
  private stamina = new Float64Array(N).fill(1);
  private speedMax = new Float64Array(N);
  private bx = L / 2;
  private by = W / 2;
  private bz = 0;
  private bvx = 0;
  private bvy = 0;
  private bvz = 0;
  /** Who has the ball (-1: loose). */
  private carrier = 9;
  private lastTeam = 0;
  /** A pass on its way: who it is for, and how long it has left. */
  private target = -1;
  private flight = 0;
  private decide = 0;
  private scan = 0;
  private dist = new Float64Array(N);

  constructor(o: TickOptions) {
    this.dt = 1 / o.hz;
    this.total = Math.round(o.minutes * 60 * o.hz);
    this.rng = new Rng(o.seed);
    this.heavy = o.heavy;
    this.track = o.record ? new Int16Array(this.total * (N * 2 + 3)) : null;
    for (let i = 0; i < N; i++) {
      const [d, w] = SPOTS[i % 11];
      const team = i < 11 ? 0 : 1;
      this.px[i] = (team === 0 ? d * 0.9 : 1 - d * 0.9) * L;
      this.py[i] = w * W;
      this.speedMax[i] = 6.5 + this.rng.next() * 2.2;
    }
  }

  get done(): boolean {
    return this.tick >= this.total;
  }

  debug(): string {
    return `carrier ${this.carrier} target ${this.target} lastTeam ${this.lastTeam} ball ${this.bx.toFixed(1)},${this.by.toFixed(1)},${this.bz.toFixed(1)} v ${this.bvx.toFixed(1)},${this.bvy.toFixed(1)},${this.bvz.toFixed(1)} flight ${this.flight.toFixed(1)} p0 ${this.px[0]},${this.py[0]}`;
  }

  /** A number that is the same for the same match (to see that it is repeatable). */
  hash(): number {
    let h = 17;
    for (let i = 0; i < N; i++) h = (Math.imul(h, 31) + Math.round(this.px[i] * 100) + Math.round(this.py[i] * 100)) | 0;
    h = (Math.imul(h, 31) + this.goals[0] * 7 + this.goals[1] * 13 + this.passes + this.tackles * 3 + this.shots * 5) | 0;
    return h;
  }

  advance(steps: number): void {
    const end = Math.min(this.total, this.tick + steps);
    while (this.tick < end) this.step();
  }

  private step(): void {
    const dt = this.dt;
    const team = this.carrier >= 0 ? (this.carrier < 11 ? 0 : 1) : this.lastTeam;
    const px = this.px, py = this.py, vx = this.vx, vy = this.vy, tx = this.tx, ty = this.ty;

    // Who is nearest the ball (for pressing and for getting to a loose ball).
    let first = -1, second = -1, d1 = 1e9, d2 = 1e9;
    for (let i = 0; i < N; i++) {
      const dx = px[i] - this.bx, dy = py[i] - this.by;
      const d = dx * dx + dy * dy;
      this.dist[i] = d;
      if (i < 11 === (team === 0)) continue; // only the side without the ball presses
      if (d < d1) { d2 = d1; second = first; d1 = d; first = i; } else if (d < d2) { d2 = d; second = i; }
    }

    // Where each player wants to be: his place, moved with the ball, the two nearest pressing, the one with the ball going forward.
    for (let i = 0; i < N; i++) {
      const t = i < 11 ? 0 : 1;
      const [d, w] = SPOTS[i % 11];
      const dir = t === 0 ? 1 : -1;
      const attacking = t === team;
      const shift = (this.bx - L / 2) * dir * (i % 11 === 0 ? 0.05 : 0.4);
      let x = (t === 0 ? d : 1 - d) * L + shift + (attacking ? dir * 6 * d : -dir * 4);
      let y = w * W + (this.by - W / 2) * 0.25;
      if (i === this.carrier) { x = this.px[i] + dir * 12; y = this.py[i] + (W / 2 - this.py[i]) * 0.1; }
      else if (i === first || i === second) { x = this.carrier >= 0 ? this.bx - dir * 1.5 : this.bx; y = this.by; }
      else if (i === this.target) { x = this.bx; y = this.by; }
      tx[i] = Math.min(L - 1, Math.max(1, x));
      ty[i] = Math.min(W - 1, Math.max(1, y));
    }

    // Heavy: every player looks round for a better place once a second (candidate spots against every opponent).
    if (this.heavy && ++this.scan >= Math.round(1 / dt)) {
      this.scan = 0;
      for (let i = 0; i < N; i++) {
        const o0 = i < 11 ? 11 : 0;
        let bestX = tx[i], bestY = ty[i], best = -1;
        for (let k = 0; k < 8; k++) {
          const a = k * 0.785;
          const cx = tx[i] + Math.cos(a) * 5, cy = ty[i] + Math.sin(a) * 5;
          let free = 1e9;
          for (let j = o0; j < o0 + 11; j++) {
            const dx = px[j] - cx, dy = py[j] - cy;
            const d = dx * dx + dy * dy;
            if (d < free) free = d;
          }
          if (free > best) { best = free; bestX = cx; bestY = cy; }
        }
        tx[i] = bestX * 0.3 + tx[i] * 0.7;
        ty[i] = bestY * 0.3 + ty[i] * 0.7;
      }
    }

    // Moving: towards the place, kept apart from team-mates, speed and turning limited, tiring with effort.
    for (let i = 0; i < N; i++) {
      let dx = tx[i] - px[i], dy = ty[i] - py[i];
      const d = Math.sqrt(dx * dx + dy * dy) + 1e-6;
      const want = Math.min(this.speedMax[i] * this.stamina[i], d * 1.6);
      dx = (dx / d) * want;
      dy = (dy / d) * want;
      const base = i < 11 ? 0 : 11;
      for (let j = base; j < base + 11; j++) {
        if (j === i) continue;
        const sx = px[i] - px[j], sy = py[i] - py[j];
        const sd = sx * sx + sy * sy;
        if (sd < 16 && sd > 1e-6) {
          const k = (4 - Math.sqrt(sd)) / 4;
          dx += sx * k;
          dy += sy * k;
        }
      }
      const ax = Math.max(-5 * dt, Math.min(5 * dt, dx - vx[i]));
      const ay = Math.max(-5 * dt, Math.min(5 * dt, dy - vy[i]));
      vx[i] += ax;
      vy[i] += ay;
      px[i] = Math.min(L, Math.max(0, px[i] + vx[i] * dt));
      py[i] = Math.min(W, Math.max(0, py[i] + vy[i] * dt));
      const speed = Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i]);
      this.stamina[i] = Math.min(1, Math.max(0.55, this.stamina[i] - speed * 0.00004 * dt * 60 + 0.00002 * dt * 60));
    }

    this.ball(team, first);

    if (this.track) {
      const base = this.tick * (N * 2 + 3);
      for (let i = 0; i < N; i++) {
        this.track[base + i * 2] = Math.round(px[i] * 100);
        this.track[base + i * 2 + 1] = Math.round(py[i] * 100);
      }
      this.track[base + N * 2] = Math.round(this.bx * 100);
      this.track[base + N * 2 + 1] = Math.round(this.by * 100);
      this.track[base + N * 2 + 2] = Math.round(this.bz * 100);
    }
    this.tick++;
  }

  private ball(team: number, nearestDefender: number): void {
    const dt = this.dt;
    const px = this.px, py = this.py;
    if (this.carrier >= 0) {
      const c = this.carrier;
      this.lastTeam = c < 11 ? 0 : 1;
      this.bx = px[c] + this.vx[c] * 0.1;
      this.by = py[c] + this.vy[c] * 0.1;
      this.bz = 0;
      // A tackle: a defender close enough has a go.
      if (nearestDefender >= 0 && this.dist[nearestDefender] < 2.25 && this.rng.next() < 0.6 * dt) {
        this.tackles++;
        this.carrier = nearestDefender;
        return;
      }
      this.decide += dt;
      if (this.decide >= 0.6) {
        this.decide = 0;
        this.decision(c);
      }
      return;
    }
    // Loose or in the air: flight, drag, bounce.
    this.bvz -= 9.8 * dt;
    this.bx += this.bvx * dt;
    this.by += this.bvy * dt;
    this.bz += this.bvz * dt;
    if (this.bz < 0) {
      this.bz = 0;
      this.bvz = -this.bvz * 0.45;
      if (Math.abs(this.bvz) < 1) this.bvz = 0;
    }
    const drag = this.bz > 0 ? 0.4 : 1.6;
    const k = Math.max(0, 1 - drag * dt);
    this.bvx *= k;
    this.bvy *= k;
    if (this.bx < 0 || this.bx > L || this.by < 0 || this.by > W) {
      // Out: the other side restarts from the nearest place inside.
      this.bx = Math.min(L, Math.max(0, this.bx));
      this.by = Math.min(W, Math.max(0, this.by));
      this.bvx = this.bvy = this.bvz = 0;
      let best = -1, bd = 1e9;
      const o0 = this.lastTeam === 0 ? 11 : 0;
      for (let i = o0; i < o0 + 11; i++) if (this.dist[i] < bd) { bd = this.dist[i]; best = i; }
      this.carrier = best;
      this.target = -1;
      return;
    }
    // Who gets to it: a pass for someone, or the nearest player when it is loose.
    for (let i = 0; i < N; i++) {
      if (this.dist[i] > 1.44 || this.bz > 2.2) continue;
      const mine = (i < 11 ? 0 : 1) === team;
      if (this.target >= 0 && i !== this.target && mine) continue;
      if (!mine && this.rng.next() > 0.3) continue;
      this.carrier = i;
      this.target = -1;
      return;
    }
    if (this.target >= 0) {
      this.flight -= dt;
      if (this.flight < -1.5) this.target = -1;
    }
  }

  /** The one with the ball chooses: shoot, pass (lanes checked against every defender) or carry on. */
  private decision(c: number): void {
    const px = this.px, py = this.py;
    const t = c < 11 ? 0 : 1;
    const dir = t === 0 ? 1 : -1;
    const goalX = t === 0 ? L : 0;
    const gd = Math.hypot(goalX - px[c], W / 2 - py[c]);
    if (gd < 28 && this.rng.next() < 0.25) {
      // A shot.
      this.shots++;
      const r = this.rng.next();
      if (r < 0.11) this.goals[t]++;
      this.bvx = dir * 24;
      this.bvy = (W / 2 - py[c]) / gd * 24 + (this.rng.next() - 0.5) * 6;
      this.bvz = 1.5;
      this.carrier = -1;
      this.target = -1;
      this.lastTeam = t;
      return;
    }
    const m0 = t === 0 ? 0 : 11;
    const o0 = t === 0 ? 11 : 0;
    let best = -1e9, bestJ = -1;
    for (let j = m0; j < m0 + 11; j++) {
      if (j === c) continue;
      const dx = px[j] - px[c], dy = py[j] - py[c];
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 4 || d > 40) continue;
      // The closest any defender gets to the line of the pass.
      let risk = 0;
      for (let k = o0; k < o0 + 11; k++) {
        const ex = px[k] - px[c], ey = py[k] - py[c];
        const u = Math.max(0, Math.min(1, (ex * dx + ey * dy) / (d * d)));
        const qx = ex - dx * u, qy = ey - dy * u;
        const q = qx * qx + qy * qy;
        if (q < 9) risk += (9 - q) / 9;
      }
      const util = (dx * dir) / L * 1.5 - risk * 0.9 - d * 0.01 + this.rng.next() * 0.3;
      if (util > best) { best = util; bestJ = j; }
    }
    if (bestJ >= 0 && best > -0.4) {
      this.passes++;
      const dx = px[bestJ] - px[c], dy = py[bestJ] - py[c];
      const d = Math.sqrt(dx * dx + dy * dy);
      const speed = 14 + this.rng.next() * 6;
      this.bvx = (dx / d) * speed;
      this.bvy = (dy / d) * speed;
      this.bvz = d > 22 ? 4 : 0;
      this.flight = d / speed;
      this.target = bestJ;
      this.carrier = -1;
      this.lastTeam = t;
    }
  }
}
