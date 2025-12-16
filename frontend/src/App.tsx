import React from 'react';
import './index.css';

export default function App() {
  return (
    <div className="app">
      <header className="app__header">LLM Flow</header>
      <main className="app__main">
        <div className="graph-placeholder" role="region" aria-label="Graph UI">
          Graph UI placeholder (React Flow)
        </div>
        <aside className="sidebar" aria-label="Sidebar">
          Sidebar placeholder (Node editor)
        </aside>
      </main>
      <footer className="app__footer" aria-live="polite">
        Footer placeholder (End node output)
      </footer>
    </div>
  );
}

