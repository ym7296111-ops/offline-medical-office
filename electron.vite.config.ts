import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin(),
      viteStaticCopy({
        targets: [
          {
            src: 'src/main/db/migrations/*.sql',
            dest: 'db/migrations'
          }
        ]
      })
    ],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          catalogs: resolve(__dirname, 'src/renderer/catalogs.html'),
          visits: resolve(__dirname, 'src/renderer/visits.html'),
          'visit-details': resolve(__dirname, 'src/renderer/visit-details.html'),
          procedures: resolve(__dirname, 'src/renderer/procedures.html'),
          discharge: resolve(__dirname, 'src/renderer/discharge.html')
        }
      }
    }
  }
});
