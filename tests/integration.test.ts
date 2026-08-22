import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import vue from '@vitejs/plugin-vue'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { build, createServer, type Plugin, type Rollup } from 'vite'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { reactVitePlugin, vueVitePlugin } from '../src/index.js'

const fixtures = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
)

function outputCode(result: Awaited<ReturnType<typeof build>>): string {
  if (!Array.isArray(result) && !('output' in result)) {
    throw new TypeError('Expected a completed Vite build output')
  }
  const outputs = Array.isArray(result) ? result : [result]
  return outputs
    .flatMap((output) => output.output)
    .filter((item): item is Rollup.OutputChunk => item.type === 'chunk')
    .map((chunk) => chunk.code)
    .join('\n')
}

describe('Vite integration', () => {
  it('renders React source locations through the Vite dev pipeline', async () => {
    const root = path.join(fixtures, 'react')
    const server = await createServer({
      root,
      appType: 'custom',
      logLevel: 'silent',
      server: { middlewareMode: true },
      plugins: [react(), reactVitePlugin({ prefix: 'react/' })],
    })

    try {
      const module = await server.ssrLoadModule('/App.tsx')
      const html = renderToStaticMarkup(createElement(module.default))

      expect(html).toMatch(
        /<main data-source-location="react\/App\.tsx:\d+:\d+">/,
      )
      expect(html).toMatch(
        /<strong data-source-location="react\/App\.tsx:\d+:\d+">child<\/strong>/,
      )
      expect(html).toMatch(
        /<span data-source-location="react\/App\.tsx:\d+:\d+">hello<\/span>/,
      )
    } finally {
      await server.close()
    }
  })

  it('reads React locations before other pre transforms rewrite JSX', async () => {
    const root = path.join(fixtures, 'react')
    const rewriteBeforeLens: Plugin = {
      name: 'rewrite-before-dom-source-lens',
      enforce: 'pre',
      transform(code, id) {
        if (!id.endsWith('/App.tsx')) return
        return `\n\n\n${code}`
      },
    }
    const server = await createServer({
      root,
      appType: 'custom',
      logLevel: 'silent',
      server: { middlewareMode: true },
      plugins: [
        react(),
        rewriteBeforeLens,
        reactVitePlugin({ prefix: 'react/' }),
      ],
    })

    try {
      const module = await server.ssrLoadModule('/App.tsx')
      const html = renderToStaticMarkup(createElement(module.default))

      expect(html).toContain(
        '<main data-source-location="react/App.tsx:9:5">',
      )
      expect(html).toContain(
        '<strong data-source-location="react/App.tsx:4:10">child</strong>',
      )
      expect(html).toContain(
        '<span data-source-location="react/App.tsx:11:7">hello</span>',
      )
    } finally {
      await server.close()
    }
  })

  it('renders Vue SFC and external-template locations through Vite', async () => {
    const root = path.join(fixtures, 'vue')
    const server = await createServer({
      root,
      appType: 'custom',
      logLevel: 'silent',
      server: { middlewareMode: true },
      plugins: [
        vue({
          template: {
            compilerOptions: {
              isCustomElement: (tag) => tag === 'x-panel',
            },
          },
        }),
        vueVitePlugin({ prefix: 'vue/' }),
      ],
    })

    try {
      const appModule = await server.ssrLoadModule('/App.vue')
      const appHtml = await renderToString(createSSRApp(appModule.default))
      const externalModule = await server.ssrLoadModule('/External.vue')
      const externalHtml = await renderToString(
        createSSRApp(externalModule.default),
      )
      expect(appHtml).toMatch(
        /<main data-source-location="vue\/App\.vue:\d+:\d+">/,
      )
      expect(appHtml).toMatch(
        /<strong data-source-location="vue\/Child\.vue:\d+:\d+">child<\/strong>/,
      )
      expect(appHtml).toMatch(
        /<span data-source-location="vue\/App\.vue:\d+:\d+">hello<\/span>/,
      )
      expect(appHtml).toMatch(
        /<x-panel data-source-location="vue\/App\.vue:\d+:\d+"><\/x-panel>/,
      )
      expect(externalHtml).toContain(
        '<article data-source-location="vue/External.html:1:1">external</article>',
      )
    } finally {
      await server.close()
    }
  })

  it('does not inject attributes into production builds', async () => {
    const reactRoot = path.join(fixtures, 'react')
    const vueRoot = path.join(fixtures, 'vue')
    const [reactResult, vueResult] = await Promise.all([
      build({
        root: reactRoot,
        logLevel: 'silent',
        plugins: [react(), reactVitePlugin()],
        build: {
          write: false,
          minify: false,
          lib: {
            entry: path.join(reactRoot, 'App.tsx'),
            formats: ['es'],
          },
        },
      }),
      build({
        root: vueRoot,
        logLevel: 'silent',
        plugins: [vue(), vueVitePlugin()],
        build: {
          write: false,
          minify: false,
          lib: {
            entry: path.join(vueRoot, 'App.vue'),
            formats: ['es'],
          },
        },
      }),
    ])

    expect(outputCode(reactResult)).not.toContain('data-source-location')
    expect(outputCode(vueResult)).not.toContain('data-source-location')
  })
})
