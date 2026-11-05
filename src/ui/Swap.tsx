// Two things taking turns in the same place (every few seconds), with a little flip each time.
import {useEffect, useState, type ReactNode} from "react";

export function Swap({a, b, ms = 3000}: {a: ReactNode; b: ReactNode; ms?: number}) {
  const [second, setSecond] = useState(false);
  useEffect(() => {
    const id = window.setInterval(() => setSecond((v) => !v), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return (
    <span className="mp-swap" key={second ? "b" : "a"}>
      {second ? b : a}
    </span>
  );
}
