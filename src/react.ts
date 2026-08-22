import type {
  NodePath,
  PluginAPI,
  PluginObject,
  PluginPass,
} from '@babel/core'
import type { JSXOpeningElement } from '@babel/types'
import type { Plugin, PluginOption, ResolvedConfig } from 'vite'
import {
  cleanId,
  resolvePluginOptions,
  sourceLocation,
  type DomToSourcePluginOptions,
  type SourcePathState,
} from './shared.js'

const DEFAULT_REACT_INCLUDE = [/\.[jt]sx?(?:$|\?)/]
const NATIVE_JSX_RE = /<[a-z][A-Za-z0-9:._-]*(?:\s|\/?>)/

interface ReactRuntimeState extends SourcePathState {}

function hasAttribute(
  api: PluginAPI,
  node: JSXOpeningElement,
  attributeName: string,
): boolean {
  return node.attributes.some(
    (attribute) =>
      api.types.isJSXAttribute(attribute) &&
      api.types.isJSXIdentifier(attribute.name, { name: attributeName }),
  )
}

export function createReactSourceLocationBabelPlugin(
  runtime: ReactRuntimeState,
  attributeName: `data-${string}`,
): (api: PluginAPI) => PluginObject {
  return (api) => ({
    name: 'dom-source-lens-react-transform',
    visitor: {
      JSXOpeningElement(
        path: NodePath<JSXOpeningElement>,
        state: PluginPass,
      ) {
        const { node } = path
        if (
          !api.types.isJSXIdentifier(node.name) ||
          !/^[a-z]/.test(node.name.name) ||
          hasAttribute(api, node, attributeName)
        ) {
          return
        }

        const filename = state.filename ?? state.file.opts.filename
        const start = node.loc?.start
        if (!filename || !start) return

        const location = sourceLocation(
          runtime,
          cleanId(filename),
          start.line,
          start.column + 1,
        )
        node.attributes.push(
          api.types.jsxAttribute(
            api.types.jsxIdentifier(attributeName),
            api.types.stringLiteral(location),
          ),
        )
      },
    },
  })
}

async function createReactVitePlugin(
  options: ReturnType<typeof resolvePluginOptions>,
): Promise<Plugin> {
  const [{ default: babelPlugin, defineRolldownBabelPreset }] =
    await Promise.all([import('@rolldown/plugin-babel')])

  const runtime: ReactRuntimeState = {
    prefix: options.prefix,
    root: process.cwd(),
    pathCache: new Map(),
  }
  const transformPlugin = createReactSourceLocationBabelPlugin(
    runtime,
    options.attributeName,
  )
  const preset = defineRolldownBabelPreset({
    preset: () => ({ plugins: [transformPlugin] }),
    rolldown: {
      filter: {
        id: {
          include: options.include,
          exclude: options.exclude,
        },
        code: NATIVE_JSX_RE,
      },
      configResolvedHook(config: ResolvedConfig) {
        runtime.root = config.root
        runtime.pathCache.clear()
        return true
      },
    },
  })
  const matchesFile = (filename: string | undefined): boolean =>
    filename !== undefined && options.filter(filename)
  const babel = await babelPlugin({
    include: matchesFile,
    parserOpts: { plugins: ['jsx'] },
    presets: [preset],
    sourceMap: true,
  })
  const transform = babel.transform

  // Capture original JSX locations before other pre transforms (for example,
  // React Compiler) rewrite the file and replace its AST locations.
  return {
    ...babel,
    name: 'dom-source-lens:react',
    enforce: 'pre',
    apply: 'serve',
    transform:
      typeof transform === 'function'
        ? { handler: transform, order: 'pre' }
        : transform
          ? { ...transform, order: 'pre' }
          : undefined,
  } as Plugin
}

export function reactVitePlugin(
  options: DomToSourcePluginOptions = {},
): PluginOption {
  const resolvedOptions = resolvePluginOptions(options, DEFAULT_REACT_INCLUDE)
  return createReactVitePlugin(resolvedOptions)
}
