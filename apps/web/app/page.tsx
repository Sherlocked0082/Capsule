export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Relay</p>
        <h1>Portable context for AI workflows.</h1>
        <p className="lede">
          Capture a conversation, turn it into a structured brief, and inject it into another tool.
        </p>
      </section>

      <section className="grid">
        <article className="panel">
          <h2>Current scope</h2>
          <p>Chat capture, brief generation, saved library, and cross-tool injection.</p>
        </article>
        <article className="panel">
          <h2>Next build steps</h2>
          <p>Auth, persistence, source adapters, target adapters, and extension wiring.</p>
        </article>
      </section>
    </main>
  );
}
