// If something in the app fails to draw, a message and a way back instead of a blank page. The save is not touched.
import {Component, type ErrorInfo, type ReactNode} from "react";

export class ErrorBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = {failed: false};

  static getDerivedStateFromError() {
    return {failed: true};
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="error-fallback" role="alert" style={{padding: 24, maxWidth: 480, margin: "10vh auto", textAlign: "center", color: "#fff"}}>
        <h2>Något gick fel · Something went wrong</h2>
        <p>Ditt sparade spel är kvar. · Your save is kept.</p>
        <button className="btn primary" onClick={() => window.location.reload()}>Försök igen · Try again</button>
      </div>
    );
  }
}
