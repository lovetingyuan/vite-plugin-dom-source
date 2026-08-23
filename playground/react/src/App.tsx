import { useState, type MouseEvent } from 'react'
import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import DetailsPage from './pages/DetailsPage'
import HomePage from './pages/HomePage'

const emptySelection = '点击页面中的元素查看源码位置'

export default function App() {
  const [selection, setSelection] = useState(emptySelection)

  function inspectSource(event: MouseEvent<HTMLElement>) {
    const target = event.target
    if (!(target instanceof Element)) return

    setSelection(
      target
        .closest('[data-source-location]')
        ?.getAttribute('data-source-location') ?? emptySelection,
    )
  }

  return (
    <main onClickCapture={inspectSource}>
      <p className="eyebrow">React + Vite</p>
      <h1>DOM 对应哪一行源码？</h1>
      <p className="intro">
        vite-plugin-dom-source 会在开发模式中给原生 DOM 元素添加源码位置。
      </p>

      <nav aria-label="示例页面">
        <NavLink to="/" end>
          <span>首页</span>
        </NavLink>
        <NavLink to="/details">
          <span>详情页</span>
        </NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/details" element={<DetailsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <output aria-live="polite">
        <span>当前源码位置</span>
        <code>{selection}</code>
      </output>
    </main>
  )
}
