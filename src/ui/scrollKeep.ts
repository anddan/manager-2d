// While a dialog is open the page behind is held still: the body is fixed in place at the scroll position
// it had (so nothing jumps, and no scrollbar comes or goes), and set free again when the last dialog closes.
import {useEffect} from "react";

let locks = 0;
let lockedAt = 0;

function lock(): void {
  if (typeof document === "undefined" || locks++ > 0) return;
  lockedAt = window.scrollY;
  const b = document.body.style;
  b.position = "fixed";
  b.top = `-${lockedAt}px`;
  b.left = "0";
  b.right = "0";
  b.width = "100%";
}

function unlock(): void {
  if (typeof document === "undefined" || locks === 0 || --locks > 0) return;
  const b = document.body.style;
  b.position = "";
  b.top = "";
  b.left = "";
  b.right = "";
  b.width = "";
  window.scrollTo(0, lockedAt);
}

/** In every dialog: the page behind stays where it is while it is open, and is where it was when it closes. */
export function useKeepScroll(): void {
  useEffect(() => {
    lock();
    return unlock;
  }, []);
}
