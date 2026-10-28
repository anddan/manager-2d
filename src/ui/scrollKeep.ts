// Puts the page back where it was when a dialog closes. While a dialog is open the page behind is held
// still (overflow hidden), and the browser may then drop its scroll position: the page would land at the
// top, or somewhere else, when the dialog is closed. The position is followed while no dialog is open
// and set again when the last one has gone.
import {useEffect} from "react";

let y = typeof window === "undefined" ? 0 : window.scrollY;
const dialogOpen = () => typeof document !== "undefined" && !!document.querySelector(".modal-backdrop, .match-dialog-backdrop");
if (typeof window !== "undefined") {
  window.addEventListener("scroll", () => { if (!dialogOpen()) y = window.scrollY; }, {passive: true});
}

/** In every dialog: when it closes (and it was the last), the page goes back to where it was. */
export function useKeepScroll(): void {
  useEffect(() => {
    return () => {
      requestAnimationFrame(() => {
        if (!dialogOpen() && Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y);
      });
    };
  }, []);
}
