import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * The pages are rendered once, at build time, and nothing of React reaches
 * a reader: `vite build --ssr src/render.tsx` compiles the renderer for
 * Node into dist-ssr/, with React and react-dom left to node_modules, and
 * scripts/prerender.mjs runs it and writes the HTML into dist/ (0021).
 * There is no client build, so no bundle, no chunk and no script on a page.
 */
export default defineConfig({
  plugins: [react()],
  // Where the pages' browser gate serves dist/ with `vite preview`, failing
  // rather than wandering to the next free port: the Studio's gate holds
  // 4394, and 4390 to 4393 are formancy.ai-data's server and apps.
  preview: { port: 4395, strictPort: true },
})
