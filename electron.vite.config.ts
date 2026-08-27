import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve('electron/main/index.ts')
      }
    },
    resolve: {
      alias: {
        '@main': resolve('electron/main'),
        '@db': resolve('electron/database')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve('electron/preload/index.ts')
      }
    }
  },
  renderer: {
    root: 'src',
    build: {
      rollupOptions: {
        input: resolve('src/index.html')
      }
    },
    resolve: {
      alias: {
        '@': resolve('src'),
        '@components': resolve('src/components'),
        '@pages': resolve('src/pages'),
        '@hooks': resolve('src/hooks'),
        '@contexts': resolve('src/contexts'),
        '@types': resolve('src/types'),
        '@lib': resolve('src/lib'),
        '@styles': resolve('src/styles')
      }
    },
    plugins: [react()]
  }
})
