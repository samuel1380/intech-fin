import React from 'react';
export class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error('[UI] Render failure:', error.name);
  }
  render() {
    if (this.state.failed)
      return (
        <main
          role="alert"
          className="min-h-screen grid place-items-center p-6 bg-slate-950 text-white"
        >
          <section className="max-w-md space-y-5">
            <p className="text-orange-300 text-sm">FININTECH / RECUPERAÇÃO</p>
            <h1 className="text-3xl font-semibold">
              Vamos retomar de onde você parou.
            </h1>
            <p className="text-slate-300">
              Não foi possível exibir esta tela. Recarregue para tentar
              novamente.
            </p>
            <button
              className="rounded-full bg-white text-slate-900 px-6 py-3"
              onClick={() => location.reload()}
            >
              Recarregar aplicativo
            </button>
          </section>
        </main>
      );
    return this.props.children;
  }
}
