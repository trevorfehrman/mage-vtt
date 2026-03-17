import path from 'node:path'
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// better-auth requires Zod 4, but TanStack Router pins Zod 3.
// When Vite bundles better-auth for SSR it resolves `zod` to the
// hoisted v3, crashing on v4-only APIs (.meta()).  Point the SSR
// bundle at the nested Zod 4 copy so both worlds coexist.
const zod4Path = path.resolve(
  __dirname,
  'node_modules/better-auth/node_modules/zod',
)

const config = defineConfig({
  ssr: {
    noExternal: ['@convex-dev/better-auth', 'better-auth'],
    resolve: {
      alias: { zod: zod4Path },
    },
  },
  plugins: [
    devtools(),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart(),
    nitro(),
    viteReact(),
  ],
})

export default config
