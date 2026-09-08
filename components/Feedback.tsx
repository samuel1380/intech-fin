import { useEffect, useState } from 'react';
export function notify(
  message: string,
  type: 'error' | 'success' | 'info' = 'info',
) {
  window.dispatchEvent(
    new CustomEvent('app:feedback', { detail: { message, type } }),
  );
}
export function Feedback() {
  const [item, setItem] = useState<{
    message: string;
    type: string;
    id: number;
  } | null>(null);
  useEffect(() => {
    const handle = (e: Event) =>
      setItem({ ...(e as CustomEvent).detail, id: Date.now() });
    const rejected = () =>
      notify(
        'A operação não foi concluída. Verifique sua conexão e tente novamente.',
        'error',
      );
    window.addEventListener('app:feedback', handle);
    window.addEventListener('unhandledrejection', rejected);
    return () => {
      window.removeEventListener('app:feedback', handle);
      window.removeEventListener('unhandledrejection', rejected);
    };
  }, []);
  useEffect(() => {
    if (!item) return;
    const timer = setTimeout(() => setItem(null), 6000);
    return () => clearTimeout(timer);
  }, [item]);
  return (
    item && (
      <div
        role={item.type === 'error' ? 'alert' : 'status'}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-lg bg-slate-900 text-white border border-slate-600 rounded-2xl p-4 shadow-xl flex gap-4 animate-fade-in-up"
      >
        <p className="flex-1 text-sm">{item.message}</p>
        <button aria-label="Fechar aviso" onClick={() => setItem(null)}>
          ×
        </button>
      </div>
    )
  );
}
export function LoadingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Carregando dados"
      className="space-y-6 w-full"
    >
      <span className="sr-only">Sincronizando dados…</span>
      <div className="skeleton h-8 w-52" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-32" />
        ))}
      </div>
      <div className="skeleton h-64" />
      <div className="skeleton h-12" />
    </div>
  );
}
