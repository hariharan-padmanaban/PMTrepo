import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { powerApps } from "@microsoft/power-apps-vite/plugin"
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), powerApps(), tailwindcss()],
  build: {
    // Keep build warning less noisy; avoid custom chunk splitting for Power Apps runtime compatibility.
    chunkSizeWarningLimit: 1200,
  },
});
