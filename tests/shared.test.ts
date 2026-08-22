import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  escapeHtmlAttribute,
  resolvePluginOptions,
  sourceLocation,
} from '../src/shared.js'

describe('shared options and locations', () => {
  it('validates data attribute names synchronously', () => {
    expect(() =>
      resolvePluginOptions({ attributeName: 'aria-location' as `data-${string}` }, []),
    ).toThrow(/lowercase kebab-case data attribute/)
    expect(() =>
      resolvePluginOptions({ attributeName: 'data-Source' }, []),
    ).toThrow(/lowercase kebab-case data attribute/)
  })

  it('merges mandatory exclusions with user filters', () => {
    const options = resolvePluginOptions(
      {
        include: /src[/\\].*\.tsx$/,
        exclude: /generated/,
      },
      [/\.jsx$/],
    )

    expect(options.filter(path.resolve('src/App.tsx'))).toBe(true)
    expect(options.filter(path.resolve('src/generated/App.tsx'))).toBe(false)
    expect(options.filter(path.resolve('node_modules/pkg/App.tsx'))).toBe(false)
    expect(options.filter('\0virtual.tsx')).toBe(false)
  })

  it('normalizes source paths and formats one-based positions', () => {
    const root = path.resolve('workspace')
    const filename = path.join(root, 'src', 'App.tsx')
    const state = { prefix: '', root, pathCache: new Map<string, string>() }

    expect(sourceLocation(state, filename, 12, 5)).toBe('src/App.tsx:12:5')
    expect(state.pathCache.size).toBe(1)
  })

  it('prepends a literal prefix to source paths', () => {
    const root = path.resolve('workspace')
    const filename = path.join(root, 'src', 'App.tsx')
    const state = {
      prefix: 'my-app/',
      root,
      pathCache: new Map<string, string>(),
    }

    expect(sourceLocation(state, filename, 12, 5)).toBe(
      'my-app/src/App.tsx:12:5',
    )
  })

  it('escapes generated HTML attribute values', () => {
    expect(escapeHtmlAttribute('a&b"<c')).toBe('a&amp;b&quot;&lt;c')
  })
})
