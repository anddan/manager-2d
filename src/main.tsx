import {StrictMode, Suspense, lazy} from "react";
import {createRoot} from "react-dom/client";
import {App} from "./ui/App";
import {ErrorBoundary} from "./ui/ErrorBoundary";
import {startAdminLog} from "./ui/adminLog";

startAdminLog();
import "./styles.css";

// With #bench at the end of the address: the measuring page for the match simulation prototype (not part of the game).
const BenchPage = lazy(() => import("./ui/BenchPage"));
const bench = window.location.hash === "#bench";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      {bench ? (
        <Suspense fallback={null}>
          <BenchPage />
        </Suspense>
      ) : (
        <App />
      )}
    </ErrorBoundary>
  </StrictMode>
);
