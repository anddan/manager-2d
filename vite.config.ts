import {defineConfig, type Plugin} from "vite";
import react from "@vitejs/plugin-react";

// Every build gets its own id: baked into the game, and written to version.json next to it.
// The running game checks version.json now and then and reloads when a newer one is out
// (see src/ui/updates.ts), so a phone with the game on its home screen picks up a deploy.
const BUILD_ID = new Date().toISOString();

function versionFile(): Plugin {
  return {
    name: "version-file",
    apply: "build",
    generateBundle() {
      this.emitFile({type: "asset", fileName: "version.json", source: JSON.stringify({id: BUILD_ID})});
    },
  };
}

export default defineConfig({
  plugins: [react(), versionFile()],
  define: {__BUILD_ID__: JSON.stringify(BUILD_ID)},
  // Reachable from a phone on the same wifi for testing.
  server: {host: true},
});
