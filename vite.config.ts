import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Reachable from a phone on the same wifi for testing.
  server: {host: true},
});
