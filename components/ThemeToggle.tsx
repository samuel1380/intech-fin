import React, { useState, useEffect } from 'react';

interface ThemeToggleProps {
    className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        // Check local storage or system preference
        if (
            localStorage.theme === 'dark' ||
            (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
        ) {
            setIsDark(true);
            document.documentElement.classList.add('dark');
        } else {
            setIsDark(false);
            document.documentElement.classList.remove('dark');
        }
    }, []);

    const toggleTheme = () => {
        if (isDark) {
            document.documentElement.classList.remove('dark');
            localStorage.theme = 'light';
            setIsDark(false);
        } else {
            document.documentElement.classList.add('dark');
            localStorage.theme = 'dark';
            setIsDark(true);
        }
    };

    return (
        <button
            onClick={toggleTheme}
            className={`relative inline-flex items-center justify-center p-2 w-12 h-12 rounded-full overflow-hidden transition-all duration-500 ease-in-out hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${className} ${isDark ? 'bg-slate-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]' : 'bg-blue-100 shadow-[inset_0_2px_6px_rgba(0,0,0,0.1)]'}`}
            aria-label="Toggle Dark Mode"
        >
            {/* Sun / Moon Wrapper */}
            <div className={`relative w-6 h-6 transform transition-transform duration-700 ease-spring ${isDark ? 'rotate-[360deg]' : 'rotate-0'}`}>

                {/* Sun */}
                <svg
                    className={`absolute inset-0 w-6 h-6 text-amber-500 transform transition-all duration-500 ${isDark ? 'scale-0 opacity-0 rotate-90' : 'scale-100 opacity-100 rotate-0'}`}
                    fill="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path d="M12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-13.44C12 2.7 11.23 2 10.28 2h-1c-.95 0-1.72.68-1.72 1.5V6h3.44V3.56zM4.93 6.34c.5-.86.5-1.94 0-2.8l-.5-.87c-.5-.86-1.58-.86-2.08 0l-.5.87c-.5.86-.5 1.94 0 2.8l.5.87c.5.86 1.58.86 2.08 0l.5-.87zM2.8 17.5l.87.5c.86.5 1.94.5 2.8 0l.87-.5c.86-.5.86-1.58 0-2.08l-.87-.5c-.86-.5-1.94-.5-2.8 0l-.87.5c-.86.5-.86 1.58 0 2.08zM12 22c.95 0 1.72-.68 1.72-1.5V18h-3.44v2.5c0 .82.77 1.5 1.72 1.5h1zM19.07 17.66c-.5.86-.5 1.94 0 2.8l.5.87c.5.86 1.58.86 2.08 0l.5-.87c.5-.86.5-1.94 0-2.8l-.5-.87c-.5-.86-1.58-.86-2.08 0l-.5.87zM21.2 6.5l-.87-.5c-.86-.5-1.94-.5-2.8 0l-.87.5c-.86.5-.86 1.58 0 2.08l.87.5c.86.5 1.94.5 2.8 0l.87-.5c.86-.5.86-1.58 0-2.08zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" fillOpacity="0.8" />
                    <circle cx="12" cy="12" r="3" />
                </svg>

                {/* Moon */}
                <svg
                    className={`absolute inset-0 w-6 h-6 text-indigo-300 transform transition-all duration-500 ${isDark ? 'scale-100 opacity-100 rotate-0' : 'scale-0 opacity-0 -rotate-90'}`}
                    fill="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z" />
                    {/* Stars */}
                    <circle cx="18" cy="6" r="1.5" className="animate-pulse" style={{ animationDelay: '0.2s' }} />
                    <circle cx="20" cy="10" r="1" className="animate-pulse" style={{ animationDelay: '0.8s' }} />
                    <circle cx="16" cy="12" r="1" className="animate-pulse" style={{ animationDelay: '0.5s' }} />
                </svg>
            </div>

            {/* Clouds / Sparkles (Subtle Effect) */}
            <div className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${isDark ? 'opacity-100' : 'opacity-0'}`}>
                <div className="absolute top-2 left-3 w-1 h-1 bg-white rounded-full opacity-60 animate-ping" style={{ animationDuration: '3s' }}></div>
            </div>

        </button>
    );
};

export default ThemeToggle;
