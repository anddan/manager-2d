// PROTOTYPE page: measures how long a match simulated in small steps takes on this device (open the app with #bench at the end of the address).
// It is only loaded then; the game itself does not use it.
import {useState} from "react";

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 20));

export default function BenchPage() {
  const [lines, setLines] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    const out: string[] = [];
    const show = () => setLines([...out]);
    const {TickSim} = await import("../game/proto/tickSim");
    out.push(`Enhet: ${navigator.userAgent}`);
    out.push(`Kärnor: ${navigator.hardwareConcurrency ?? "?"}`);
    show();
    await pause();

    // A few runs first, so the browser has learnt the code.
    for (let i = 0; i < 3; i++) new TickSim({hz: 5, minutes: 95, heavy: false, seed: 1, record: false}).advance(1e9);

    for (const [name, hz, heavy] of [["5 steg/s", 5, false], ["5 steg/s, tyngre", 5, true], ["10 steg/s, tyngre", 10, true]] as const) {
      const ms: number[] = [];
      for (let r = 0; r < 6; r++) {
        const t0 = performance.now();
        const sim = new TickSim({hz, minutes: 95, heavy, seed: 100 + r, record: false});
        sim.advance(sim.total);
        ms.push(performance.now() - t0);
        await pause();
      }
      out.push(`${name}: en hel match tar i median ${median(ms).toFixed(0)} ms (snabbast ${Math.min(...ms).toFixed(0)}, långsammast ${Math.max(...ms).toFixed(0)})`);
      show();
    }

    // Looking at a match: a few steps per frame. The worst frame is what could be felt (a frame is 16,7 ms).
    {
      const sim = new TickSim({hz: 5, minutes: 95, heavy: true, seed: 5, record: true});
      const frames: number[] = [];
      while (!sim.done) {
        const t0 = performance.now();
        sim.advance(6);
        frames.push(performance.now() - t0);
      }
      out.push(`Titta på match (6 steg per bildruta, tyngre, med inspelning): median ${median(frames).toFixed(3)} ms, värsta ${Math.max(...frames).toFixed(2)} ms av 16,7 ms`);
      show();
    }

    // A round of matches in one go.
    {
      const t0 = performance.now();
      for (let m = 0; m < 10; m++) {
        const sim = new TickSim({hz: 5, minutes: 95, heavy: false, seed: 300 + m, record: false});
        sim.advance(sim.total);
      }
      out.push(`10 matcher i rad (5 steg/s): ${(performance.now() - t0).toFixed(0)} ms`);
      show();
    }
    out.push("Klart. Jämför med datorn: 67 ms (5 steg/s), 169 ms (tyngre), 124/237 ms (10 steg/s).");
    show();
    setRunning(false);
  };

  return (
    <div style={{maxWidth: 640, margin: "0 auto", padding: 16, font: "16px system-ui, sans-serif", color: "#e5e7eb", background: "#0b1430", minHeight: "100vh"}}>
      <h1 style={{fontSize: "1.3rem"}}>Mätning: matchsimulering i små steg</h1>
      <p>Mäter hur lång tid en hel match tar att simulera med spelare och boll på den här enheten. Spelet påverkas inte. Stäng andra flikar först.</p>
      <button onClick={run} disabled={running} style={{padding: "12px 20px", fontSize: "1rem", borderRadius: 10, border: 0, background: "#2563eb", color: "#fff"}}>
        {running ? "Mäter…" : "Kör mätning"}
      </button>
      <pre style={{whiteSpace: "pre-wrap", marginTop: 16, fontSize: "0.9rem"}}>{lines.join("\n")}</pre>
      <p style={{marginTop: 24}}><a href="#" onClick={() => location.reload()} style={{color: "#93c5fd"}}>Tillbaka till spelet</a></p>
    </div>
  );
}
