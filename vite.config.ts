import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";

// Vite's explicit 'pages' mode is the only static /think-tank/ build.
// Ordinary local dev and Vessie's two-app runner still use the root base.
export default defineConfig(({mode})=>({
  plugins:[react()],
  base:mode==="pages"?"/think-tank/":"/"
}));
