import { useEffect, useState } from 'react';

export function useDarkMode() {
    const [theme, setTheme] = useState<string>(
        typeof window !== 'undefined' ? localStorage.theme : 'light'
    );

    useEffect(() => {
        const root = window.document.documentElement;
        const isDark =
            theme === 'dark' ||
            (!('theme' in localStorage) &&
                window.matchMedia('(prefers-color-scheme: dark)').matches);

        root.classList.remove(isDark ? 'light' : 'dark');
        root.classList.add(isDark ? 'dark' : 'light');

        // Explicit check for tailwind dark mode
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        localStorage.setItem('theme', theme);
    }, [theme]);

    // Listen for system changes if no preference
    useEffect(() => {
        if (!('theme' in localStorage)) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleChange = () => {
                if (mediaQuery.matches) setTheme('dark');
                else setTheme('light');
            }
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }
    }, []);

    return [theme, setTheme] as const;
}
