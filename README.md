# vite-plugin-dom-source

![Vibe Coding](https://img.shields.io/badge/vibe-coding-ff69b4)
[![npm version](https://img.shields.io/npm/v/vite-plugin-dom-source.svg)](https://www.npmjs.com/package/vite-plugin-dom-source)

Vite plugins that add a source location to rendered React and Vue 3 DOM elements during development.

```html
<button data-source-location="src/components/Button.tsx:12:5">
```

Locations are relative to the resolved Vite root, use `/` separators, and use one-based line and column numbers pointing at the opening `<`.

## Requirements

- Node.js 22.18 or newer on the Node 22 line, or Node.js 24.11 or newer
- Vite 8
- React 19 with `@vitejs/plugin-react` 6, or Vue 3.5 with `@vitejs/plugin-vue` 6

## Install

```sh
npm install --save-dev vite-plugin-dom-source
```

## React

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { reactVitePlugin } from 'vite-plugin-dom-source'

export default defineConfig({
  plugins: [react(), reactVitePlugin()],
})
```

The React plugin annotates lowercase JSX intrinsic elements, including HTML, SVG, and custom elements. Components and fragments are not annotated, so component props are never polluted.

## Vue

```ts
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { vueVitePlugin } from 'vite-plugin-dom-source'

export default defineConfig({
  plugins: [vue(), vueVitePlugin()],
})
```

The Vue plugin supports inline SFC HTML templates and external HTML templates declared with `template src`. It follows `@vitejs/plugin-vue`'s `isCustomElement` option. Component, slot, template, Teleport, and other non-DOM nodes are skipped.

Pug, Jade, other template preprocessors, and Vue JSX are intentionally not transformed.

## Playground

This repository includes minimal React Router and Vue Router Vite apps under
`playground/`. Both apps import `vite-plugin-dom-source` through the local npm workspace
and display the source location of whichever rendered element you click, even
as you navigate between pages.

```sh
npm install
npm run dev:react
# or, in another terminal
npm run dev:vue
```

React runs on `http://localhost:5173` and Vue runs on
`http://localhost:5174`. The source attributes are available while the Vite
development server is running; production builds intentionally omit them.

## Options

Both plugins accept the same options:

```ts
interface DomToSourcePluginOptions {
  include?: string | RegExp | Array<string | RegExp>
  exclude?: string | RegExp | Array<string | RegExp>
  attributeName?: `data-${string}`
  prefix?: string
  generateSourcePath?: (
    sourcePath: string,
    line: number,
    column: number,
  ) => string
}
```

```ts
reactVitePlugin({
  include: ['src/**/*.{jsx,tsx}'],
  exclude: /generated/,
  attributeName: 'data-origin',
  prefix: 'my-app/',
  generateSourcePath: (sourcePath, line, column) =>
    `${sourcePath}#L${line}C${column}`,
})
```

`attributeName` defaults to `data-source-location` and must be a lowercase kebab-case `data-*` name. `node_modules` and virtual modules are always excluded. A source element that already has the configured attribute is left unchanged.

`prefix` is prepended literally to the root-relative source path. For example, `prefix: 'my-app/'` produces `my-app/src/App.tsx:12:5`. Include any desired separator in the prefix.

`generateSourcePath` customizes the complete source location value. It receives the normalized, root-relative source path after `prefix` has been applied, followed by one-based line and column numbers. Its return value is injected directly instead of the default `path:line:column` format. The callback is synchronous and should be a pure function.

## Development only

Both plugins use `apply: 'serve'`. Production builds are never modified, avoiding production bundle overhead and disclosure of source paths. The transformation has no browser runtime.

## License

MIT
