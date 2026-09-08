import { useEffect, useState } from 'react';
function preference() {
  try {
    return localStorage.getItem('theme');
  } catch {
    return null;
  }
}
export function useDarkMode() {
  const [theme, setTheme] = useState(
    () =>
      preference() ||
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  );
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const sync = () =>
      setTheme(preference() || (media.matches ? 'dark' : 'light'));
    media.addEventListener('change', sync);
    window.addEventListener('storage', sync);
    return () => {
      media.removeEventListener('change', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const update = (value: string) => {
    try {
      localStorage.setItem('theme', value);
    } catch {
      console.warn('Tema aplicado somente nesta sessão.');
    }
    setTheme(value);
  };
  return [theme, update] as const;
}
