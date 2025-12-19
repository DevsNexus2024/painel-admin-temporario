import React from 'react';

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type State = {
  hasError: boolean;
  error?: unknown;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Log explícito pra produção (evita "tela preta" sem contexto)
    // eslint-disable-next-line no-console
    console.error('[UI-ERROR-BOUNDARY] Uncaught UI error', { error, info });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg w-full rounded-lg border border-border bg-card p-6 space-y-4">
            <h1 className="text-lg font-semibold">Algo deu errado nesta tela</h1>
            <p className="text-sm text-muted-foreground">
              Para continuar, tente recarregar a página. Se persistir, copie o erro do console e envie para o suporte.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => window.location.reload()}
              >
                Recarregar
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-md border border-border bg-background hover:bg-accent"
                onClick={() => this.setState({ hasError: false, error: undefined })}
              >
                Tentar novamente
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}


