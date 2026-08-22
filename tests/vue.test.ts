import path from 'node:path'
import * as compiler from '@vue/compiler-dom'
import { describe, expect, it } from 'vitest'
import { transformVueSource } from '../src/vue.js'

function createRuntime(
  root: string,
  isCustomElement?: (tag: string) => boolean,
) {
  return {
    prefix: '',
    root,
    pathCache: new Map<string, string>(),
    nonHtmlSfcFiles: new Set<string>(),
    ...(isCustomElement ? { isCustomElement } : {}),
  }
}

describe('Vue source location transform', () => {
  it('annotates native SFC elements and skips components and slots', async () => {
    const root = path.resolve('project')
    const filename = path.join(root, 'src', 'Card.vue')
    const code = `<script setup>const title = 'Card'</script>
<template>
  <section id="card">
    <MyButton />
    <svg><path /></svg>
    <slot />
  </section>
</template>`
    const result = await transformVueSource(code, {
      attributeName: 'data-source-location',
      compiler,
      filename,
      parseMode: 'sfc',
      runtime: createRuntime(root),
    })

    expect(result?.code).toContain('data-source-location="src/Card.vue:3:3"')
    expect(result?.code).toContain('data-source-location="src/Card.vue:5:5"')
    expect(result?.code).toContain('data-source-location="src/Card.vue:5:10"')
    expect(result?.code).not.toMatch(/<MyButton[^>]*data-source-location/)
    expect(result?.code).not.toMatch(/<slot[^>]*data-source-location/)
    expect(result?.map).toBeDefined()
  })

  it('maps external HTML to the external source file', async () => {
    const root = path.resolve('project')
    const filename = path.join(root, 'src', 'External.html')
    const result = await transformVueSource('<article>external</article>', {
      attributeName: 'data-source-location',
      compiler,
      filename,
      parseMode: 'html',
      runtime: createRuntime(root),
    })

    expect(result?.code).toContain(
      'data-source-location="src/External.html:1:1"',
    )
  })

  it('uses Vue custom-element classification', async () => {
    const root = path.resolve('project')
    const filename = path.join(root, 'src', 'Custom.vue')
    const result = await transformVueSource(
      '<template><x-panel /><regular-component /></template>',
      {
        attributeName: 'data-origin',
        compiler,
        filename,
        parseMode: 'sfc',
        runtime: createRuntime(root, (tag) => tag === 'x-panel'),
      },
    )

    expect(result?.code).toMatch(/<x-panel data-origin=/)
    expect(result?.code).not.toMatch(/<regular-component[^>]*data-origin/)
  })

  it('preserves static and dynamic user attributes and is idempotent', async () => {
    const root = path.resolve('project')
    const filename = path.join(root, 'src', 'Existing.vue')
    const code = `<template>
  <div data-source-location="manual" />
  <span :data-source-location="manual" />
  <p />
</template>`
    const runtime = createRuntime(root)
    const first = await transformVueSource(code, {
      attributeName: 'data-source-location',
      compiler,
      filename,
      parseMode: 'sfc',
      runtime,
    })
    const second = await transformVueSource(first?.code ?? code, {
      attributeName: 'data-source-location',
      compiler,
      filename,
      parseMode: 'sfc',
      runtime,
    })

    expect(first?.code.match(/data-source-location=/g)).toHaveLength(3)
    expect(second).toBeUndefined()
  })

  it('skips non-HTML and invalid templates', async () => {
    const root = path.resolve('project')
    const runtime = createRuntime(root)
    const pugFilename = path.join(root, 'src', 'Pug.vue')
    const pug = await transformVueSource(
      '<template lang="pug">\n  div content\n</template>',
      {
        attributeName: 'data-source-location',
        compiler,
        filename: pugFilename,
        parseMode: 'sfc',
        runtime,
      },
    )
    const invalid = await transformVueSource('<div><span></div>', {
      attributeName: 'data-source-location',
      compiler,
      filename: path.join(root, 'src', 'Invalid.html'),
      parseMode: 'html',
      runtime,
    })

    expect(pug).toBeUndefined()
    expect(runtime.nonHtmlSfcFiles.has(pugFilename)).toBe(true)
    expect(invalid).toBeUndefined()
  })
})
