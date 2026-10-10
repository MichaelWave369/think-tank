import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";

// The public Pages build is a static app served at /think-tank/.
// Local dev and the existing two-app Vessie acceptance remain at /.
const publicPages=process.env.VITE_PUBLIC_PAGES==="true";
export default defineConfig({
  plugins:[react()],
  base:publicPages?"/think-tank/":"/"
});
