import type {
  DirectiveNode,
  ElementNode,
  ParserOptions,
  RootNode,
  TemplateChildNode,
} from '@vue/compiler-dom'
import type MagicString from 'magic-string'
import type { Plugin, PluginOption, ResolvedConfig } from 'vite'
import {
  cleanId,
  escapeHtmlAttribute,
  resolvePluginOptions,
  sourceLocation,
  type DomToSourcePluginOptions,
  type SourcePathState,
} from './shared.js'

const DEFAULT_VUE_INCLUDE = [/\.(?:vue|html)$/]
const VUE_TRANSFORM_ID_FILTER = [
  /\.vue(?:$|\?)/,
  /[?&]vue(?:&|$)/,
]

interface VueRuntimeState extends SourcePathState {
  isCustomElement?: ParserOptions['isCustomElement']
  readonly nonHtmlSfcFiles: Set<string>
}

interface VueRequest {
  filename: string
  isMainSfc: boolean
  isTemplate: boolean
  isRaw: boolean
}

interface VueCompilerModule {
  ElementTypes: typeof import('@vue/compiler-dom').ElementTypes
  NodeTypes: typeof import('@vue/compiler-dom').NodeTypes
  parse: typeof import('@vue/compiler-dom').parse
}

interface VueTransformOptions {
  attributeName: `data-${string}`
  compiler: VueCompilerModule
  filename: string
  parseMode: 'html' | 'sfc'
  runtime: VueRuntimeState
}

function parseVueRequest(id: string): VueRequest {
  const filename = cleanId(id)
  const queryIndex = id.indexOf('?')
  const query = new URLSearchParams(
    queryIndex === -1 ? '' : id.slice(queryIndex + 1),
  )
  const isVueRequest = query.has('vue')

  return {
    filename,
    isMainSfc: filename.endsWith('.vue') && !isVueRequest,
    isTemplate: isVueRequest && query.get('type') === 'template',
    isRaw: query.has('raw') || query.has('url'),
  }
}

function staticAttributeValue(
  compiler: VueCompilerModule,
  node: ElementNode,
  name: string,
): string | true | undefined {
  const attribute = node.props.find(
    (prop) =>
      prop.type === compiler.NodeTypes.ATTRIBUTE && prop.name === name,
  )
  if (!attribute || attribute.type !== compiler.NodeTypes.ATTRIBUTE) {
    return undefined
  }
  return attribute.value?.content ?? true
}

function isNamedBind(
  compiler: VueCompilerModule,
  prop: DirectiveNode,
  attributeName: string,
): boolean {
  return (
    prop.name === 'bind' &&
    prop.arg?.type === compiler.NodeTypes.SIMPLE_EXPRESSION &&
    prop.arg.isStatic &&
    prop.arg.content === attributeName
  )
}

function hasSourceAttribute(
  compiler: VueCompilerModule,
  node: ElementNode,
  attributeName: string,
): boolean {
  return node.props.some((prop) => {
    if (prop.type === compiler.NodeTypes.ATTRIBUTE) {
      return prop.name === attributeName
    }
    return (
      prop.type === compiler.NodeTypes.DIRECTIVE &&
      isNamedBind(compiler, prop, attributeName)
    )
  })
}

function collectNativeElements(
  compiler: VueCompilerModule,
  root: RootNode | ElementNode,
): ElementNode[] {
  const result: ElementNode[] = []
  const stack: TemplateChildNode[] = [...root.children].reverse()

  while (stack.length > 0) {
    const node = stack.pop()
    if (!node || node.type !== compiler.NodeTypes.ELEMENT) continue

    if (node.tagType === compiler.ElementTypes.ELEMENT) result.push(node)
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      const child = node.children[index]
      if (child) stack.push(child)
    }
  }

  return result
}

export async function transformVueSource(
  code: string,
  options: VueTransformOptions,
): Promise<
  | {
      code: string
      map: ReturnType<MagicString['generateMap']>
    }
  | undefined
> {
  const { default: MagicString } = await import('magic-string')
  const errors: unknown[] = []
  const parserOptions: ParserOptions = {
    comments: true,
    onError: (error) => errors.push(error),
    ...(options.parseMode === 'sfc' ? { parseMode: 'sfc' as const } : {}),
    ...(options.runtime.isCustomElement
      ? { isCustomElement: options.runtime.isCustomElement }
      : {}),
  }
  const ast = options.compiler.parse(code, parserOptions)
  if (errors.length > 0) return undefined

  let root: RootNode | ElementNode = ast
  if (options.parseMode === 'sfc') {
    const template = ast.children.find(
      (node): node is ElementNode =>
        node.type === options.compiler.NodeTypes.ELEMENT &&
        node.tag === 'template',
    )
    if (!template) return undefined

    const lang = staticAttributeValue(
      options.compiler,
      template,
      'lang',
    )
    const hasSrc =
      staticAttributeValue(options.compiler, template, 'src') !== undefined
    if (typeof lang === 'string' && lang.toLowerCase() !== 'html') {
      options.runtime.nonHtmlSfcFiles.add(options.filename)
      return undefined
    }
    options.runtime.nonHtmlSfcFiles.delete(options.filename)
    if (hasSrc) return undefined
    root = template
  }

  const elements = collectNativeElements(options.compiler, root)
  if (elements.length === 0) return undefined

  const source = new MagicString(code, { filename: options.filename })
  let changed = false
  for (const element of elements) {
    if (
      hasSourceAttribute(
        options.compiler,
        element,
        options.attributeName,
      )
    ) {
      continue
    }

    const insertOffset = element.props.length
      ? Math.max(...element.props.map((prop) => prop.loc.end.offset))
      : element.loc.start.offset + element.tag.length + 1
    const location = sourceLocation(
      options.runtime,
      options.filename,
      element.loc.start.line,
      element.loc.start.column,
    )
    source.appendLeft(
      insertOffset,
      ` ${options.attributeName}="${escapeHtmlAttribute(location)}"`,
    )
    changed = true
  }

  if (!changed) return undefined
  return {
    code: source.toString(),
    map: source.generateMap({
      hires: true,
      includeContent: true,
      source: options.filename,
    }),
  }
}

function findVueIsCustomElement(
  config: ResolvedConfig,
): ParserOptions['isCustomElement'] | undefined {
  for (const plugin of config.plugins) {
    if (plugin.name !== 'vite:vue') continue
    const api = (plugin as Plugin & {
      api?: {
        options?: {
          template?: {
            compilerOptions?: {
              isCustomElement?: ParserOptions['isCustomElement']
            }
          }
        }
      }
    }).api
    const isCustomElement =
      api?.options?.template?.compilerOptions?.isCustomElement
    if (isCustomElement) return isCustomElement
  }
  return undefined
}

async function createVueVitePlugin(
  options: ReturnType<typeof resolvePluginOptions>,
): Promise<Plugin> {
  const compiler = await import('@vue/compiler-dom')
  const runtime: VueRuntimeState = {
    ...(options.generateSourcePath
      ? { generateSourcePath: options.generateSourcePath }
      : {}),
    prefix: options.prefix,
    root: process.cwd(),
    pathCache: new Map(),
    nonHtmlSfcFiles: new Set(),
  }

  return {
    name: 'vite-plugin-dom-source:vue',
    enforce: 'pre',
    apply: 'serve',
    configResolved(config) {
      runtime.root = config.root
      runtime.pathCache.clear()
      runtime.isCustomElement = findVueIsCustomElement(config)
    },
    transform: {
      filter: { id: VUE_TRANSFORM_ID_FILTER },
      async handler(code, id) {
        const request = parseVueRequest(id)
        if (
          request.isRaw ||
          (!request.isMainSfc && !request.isTemplate) ||
          !options.filter(request.filename)
        ) {
          return undefined
        }

        if (
          request.isTemplate &&
          (runtime.nonHtmlSfcFiles.has(request.filename) ||
            /\.(?:pug|jade)$/i.test(request.filename))
        ) {
          return undefined
        }

        return transformVueSource(code, {
          attributeName: options.attributeName,
          compiler,
          filename: request.filename,
          parseMode: request.isMainSfc ? 'sfc' : 'html',
          runtime,
        })
      },
    },
  }
}

export function vueVitePlugin(
  options: DomToSourcePluginOptions = {},
): PluginOption {
  const resolvedOptions = resolvePluginOptions(options, DEFAULT_VUE_INCLUDE)
  return createVueVitePlugin(resolvedOptions)
}
