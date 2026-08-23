<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'

const emptySelection = '点击页面中的元素查看源码位置'
const selection = ref(emptySelection)

function inspectSource(event: MouseEvent) {
  const target = event.target
  if (!(target instanceof Element)) return

  selection.value =
    target
      .closest('[data-source-location]')
      ?.getAttribute('data-source-location') ?? emptySelection
}
</script>

<template>
  <main @click.capture="inspectSource">
    <p class="eyebrow">Vue + Vite</p>
    <h1>DOM 对应哪一行源码？</h1>
    <p class="intro">
      vite-plugin-dom-source 会在开发模式中给原生 DOM 元素添加源码位置。
    </p>

    <nav aria-label="示例页面">
      <RouterLink to="/"><span>首页</span></RouterLink>
      <RouterLink to="/details"><span>详情页</span></RouterLink>
    </nav>

    <section>
      <RouterView />
    </section>

    <output aria-live="polite">
      <span>当前源码位置</span>
      <code>{{ selection }}</code>
    </output>
  </main>
</template>
