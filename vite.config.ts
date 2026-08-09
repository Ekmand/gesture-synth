import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import basicSsl from "@vitejs/plugin-basic-ssl"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: true, // expose on LAN IP for phone / other computers
    // HTTPS via @vitejs/plugin-basic-ssl (needed for getUserMedia off localhost)
  },
})
