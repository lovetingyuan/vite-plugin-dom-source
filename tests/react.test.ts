import path from 'node:path'
import { transformAsync } from '@babel/core'
import { describe, expect, it } from 'vitest'
import { createReactSourceLocationBabelPlugin } from '../src/react.js'

async function transformReact(
  code: string,
  filename = path.resolve('project/src/App.tsx'),
  attributeName: `data-${string}` = 'data-source-location',
  generateSourcePath?: (
    sourcePath: string,
    line: number,
    column: number,
  ) => string,
): Promise<string> {
  const root = path.resolve('project')
  const result = await transformAsync(code, {
    babelrc: false,
    configFile: false,
    filename,
    parserOpts: { plugins: ['typescript', 'jsx'] },
    sourceMaps: true,
    plugins: [
      createReactSourceLocationBabelPlugin(
        {
          ...(generateSourcePath ? { generateSourcePath } : {}),
          prefix: '',
          root,
          pathCache: new Map(),
        },
        attributeName,
      ),
    ],
  })
  expect(result?.map).toBeDefined()
  return result?.code ?? ''
}

describe('React source location transform', () => {
  it('annotates native JSX and skips components and fragments', async () => {
    const output = await transformReact(`const view = (
  <main id="root">
    <Button />
    <svg><path /></svg>
    <my-widget />
    <><span /></>
  </main>
)`)

    expect(output).toContain('data-source-location="src/App.tsx:2:3"')
    expect(output).toContain('data-source-location="src/App.tsx:4:5"')
    expect(output).toContain('data-source-location="src/App.tsx:4:10"')
    expect(output).toContain('data-source-location="src/App.tsx:5:5"')
    expect(output).toContain('data-source-location="src/App.tsx:6:7"')
    expect(output).not.toMatch(/<Button[^>]*data-source-location/)
  })

  it('is idempotent and preserves an existing attribute', async () => {
    const first = await transformReact(`const view = <div {...props} data-source-location="manual"><span /></div>`)
    const second = await transformReact(first)

    expect(first.match(/data-source-location=/g)).toHaveLength(2)
    expect(second.match(/data-source-location=/g)).toHaveLength(2)
    expect(second).toContain('data-source-location="manual"')
  })

  it('appends after spreads and supports a custom attribute name', async () => {
    const output = await transformReact(
      'const view = <section {...props} />',
      path.resolve('project/src/View.jsx'),
      'data-origin',
    )

    expect(output).toMatch(/<section \{\.\.\.props\} data-origin="src\/View\.jsx:1:14"/)
    expect(output).not.toContain('data-source-location')
  })

  it('normalizes Windows paths', async () => {
    const root = path.resolve('project')
    const filename = path.join(root, 'features', 'Panel.tsx')
    const output = await transformReact('const view = <aside />', filename)

    expect(output).toContain('data-source-location="features/Panel.tsx:1:14"')
  })

  it('uses a custom source location generator', async () => {
    const output = await transformReact(
      'const view = <aside />',
      path.resolve('project/src/Panel.tsx'),
      'data-source-location',
      (sourcePath, line, column) => `${sourcePath}#L${line}C${column}`,
    )

    expect(output).toContain(
      'data-source-location="src/Panel.tsx#L1C14"',
    )
  })
})
