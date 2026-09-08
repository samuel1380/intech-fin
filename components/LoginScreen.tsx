import { useState } from 'react';
import {
  ArrowUpRight,
  Eye,
  EyeOff,
  LockKeyhole,
  LoaderCircle,
} from 'lucide-react';
export default function LoginScreen({
  onLogin,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  return (
    <main className="login-layout">
      <section className="login-story" aria-label="FinIntech gestão financeira">
        <a href="/" className="login-brand">
          <span className="brand-mark">
            fi<span>↗</span>
          </span>
          <span>
            FinIntech<span className="brand-subtitle">GESTÃO FINANCEIRA</span>
          </span>
        </a>
        <div className="story-content">
          <p className="eyebrow">MENOS RUÍDO. MAIS CLAREZA.</p>
          <h1>
            Seu financeiro,
            <br />
            em perspectiva<span className="text-orange-400">.</span>
          </h1>
          <p className="story-description">
            Do primeiro recebimento à próxima decisão. Uma visão organizada de
            tudo que movimenta seu negócio.
          </p>
          <div className="story-rule" />
          <div className="story-features">
            <span>
              <b>01</b> Fluxo de caixa
            </span>
            <span>
              <b>02</b> Contas e prazos
            </span>
            <span>
              <b>03</b> Relatórios
            </span>
          </div>
        </div>
        <div className="story-footer">
          <span>Controle para hoje. Visão para amanhã.</span>
          <ArrowUpRight size={20} />
        </div>
      </section>
      <section className="login-access">
        <div className="login-form-wrap animate-fade-in-up">
          <div className="access-icon">
            <LockKeyhole size={21} strokeWidth={1.6} />
          </div>
          <p className="eyebrow text-slate-500">SEU ESPAÇO DE GESTÃO</p>
          <h2>Bem-vindo de volta.</h2>
          <p className="login-description">
            Entre para acompanhar o que importa.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (loading) return;
              setLoading(true);
              setError('');
              try {
                await onLogin(email, password);
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : 'Não foi possível entrar. Tente novamente.',
                );
              } finally {
                setLoading(false);
              }
            }}
            className="space-y-5"
          >
            <div>
              <label htmlFor="login-email">E-mail</label>
              <input
                id="login-email"
                autoComplete="username"
                type="email"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com.br"
                required
                aria-invalid={!!error}
              />
            </div>
            <div>
              <label htmlFor="login-password">Senha</label>
              <div className="relative">
                <input
                  id="login-password"
                  className="pr-12"
                  autoComplete="current-password"
                  type={visible ? 'text' : 'password'}
                  maxLength={256}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  required
                  aria-invalid={!!error}
                  aria-describedby={error ? 'login-error' : undefined}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>
            {error && (
              <p
                id="login-error"
                role="alert"
                className="rounded-xl bg-rose-50 text-rose-700 border border-rose-200 px-4 py-3 text-sm"
              >
                {error}
              </p>
            )}
            <button type="submit" disabled={loading} className="login-submit">
              {loading ? (
                <>
                  <LoaderCircle className="animate-spin" size={18} /> Entrando…
                </>
              ) : (
                <>
                  Acessar meu painel <ArrowUpRight size={19} />
                </>
              )}
            </button>
          </form>
          <p className="login-security">
            <LockKeyhole size={13} /> Acesso exclusivo à sua conta.
          </p>
        </div>
        <footer className="login-footer">
          FinIntech <span>Seu negócio em bons números.</span>
        </footer>
      </section>
    </main>
  );
}
