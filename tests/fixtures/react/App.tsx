import React from 'react'

function Child() {
  return <strong>child</strong>
}

export default function App() {
  return (
    <main>
      <Child />
      <span>hello</span>
    </main>
  )
}
