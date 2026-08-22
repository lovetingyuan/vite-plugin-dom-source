import path from 'node:path'
import { createFilter, normalizePath } from 'vite'

export type FilterPattern =
  | string
  | RegExp
  | Array<string | RegExp>

export interface DomToSourcePluginOptions {
  include?: FilterPattern
  exclude?: FilterPattern
  attributeName?: `data-${string}`
  prefix?: string
}

export interface ResolvedDomToSourceOptions {
  attributeName: `data-${string}`
  exclude: Array<string | RegExp>
  filter: (id: string) => boolean
  include: Array<string | RegExp>
  prefix: string
}

export interface SourcePathState {
  prefix: string
  root: string
  readonly pathCache: Map<string, string>
}

export const DEFAULT_ATTRIBUTE_NAME = 'data-source-location' as const

const ATTRIBUTE_NAME_RE = /^data-[a-z0-9]+(?:-[a-z0-9]+)*$/
const ALWAYS_EXCLUDE: Array<string | RegExp> = [
  /[/\\]node_modules[/\\]/,
  /^\0/,
]

function toArray(pattern: FilterPattern | undefined): Array<string | RegExp> {
  if (pattern === undefined) return []
  return Array.isArray(pattern) ? [...pattern] : [pattern]
}

export function resolvePluginOptions(
  options: DomToSourcePluginOptions,
  defaultInclude: Array<string | RegExp>,
): ResolvedDomToSourceOptions {
  const attributeName = options.attributeName ?? DEFAULT_ATTRIBUTE_NAME

  if (!ATTRIBUTE_NAME_RE.test(attributeName)) {
    throw new TypeError(
      `[dom-source-lens] "attributeName" must be a lowercase kebab-case data attribute, received ${JSON.stringify(attributeName)}.`,
    )
  }

  const include = options.include
    ? toArray(options.include)
    : [...defaultInclude]
  const exclude = [...ALWAYS_EXCLUDE, ...toArray(options.exclude)]
  const filter = createFilter(include, exclude)

  return {
    attributeName,
    exclude,
    filter: (id) => filter(cleanId(id)),
    include,
    prefix: options.prefix ?? '',
  }
}

export function cleanId(id: string): string {
  const queryIndex = id.indexOf('?')
  const hashIndex = id.indexOf('#')
  const end = Math.min(
    queryIndex === -1 ? id.length : queryIndex,
    hashIndex === -1 ? id.length : hashIndex,
  )
  return id.slice(0, end)
}

export function sourcePathFor(
  state: SourcePathState,
  filename: string,
): string {
  const cleanFilename = cleanId(filename)
  const cached = state.pathCache.get(cleanFilename)
  if (cached !== undefined) return cached

  const absoluteFilename = path.isAbsolute(cleanFilename)
    ? cleanFilename
    : path.resolve(state.root, cleanFilename)
  const relativePath = normalizePath(path.relative(state.root, absoluteFilename))
  const normalizedPath =
    relativePath || normalizePath(path.basename(absoluteFilename))
  const result = `${state.prefix}${normalizedPath}`
  state.pathCache.set(cleanFilename, result)
  return result
}

export function sourceLocation(
  state: SourcePathState,
  filename: string,
  line: number,
  column: number,
): string {
  return `${sourcePathFor(state, filename)}:${line}:${column}`
}

export function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
}
