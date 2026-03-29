import React, { useState, useEffect } from 'react';

interface ThemeToggleProps {
    className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
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
            className={`group relative flex items-center w-[68px] h-[34px] rounded-full p-[3px] transition-all duration-500 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 ${className} ${
                isDark
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-700 shadow-lg shadow-indigo-500/25'
                    : 'bg-gradient-to-r from-amber-400 to-orange-400 shadow-lg shadow-amber-400/25'
            }`}
            aria-label="Alternar modo claro/escuro"
            title={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
        >
            {/* Background decorations - stars for dark, clouds for light */}
            <div className={`absolute inset-0 rounded-full overflow-hidden transition-opacity duration-500 ${isDark ? 'opacity-100' : 'opacity-0'}`}>
                <div className="absolute top-[7px] left-[12px] w-[3px] h-[3px] bg-white/60 rounded-full animate-pulse" style={{ animationDuration: '2s' }}></div>
                <div className="absolute top-[15px] left-[22px] w-[2px] h-[2px] bg-white/40 rounded-full animate-pulse" style={{ animationDuration: '3s', animationDelay: '0.5s' }}></div>
                <div className="absolute bottom-[8px] left-[8px] w-[2px] h-[2px] bg-white/50 rounded-full animate-pulse" style={{ animationDuration: '2.5s', animationDelay: '1s' }}></div>
                <div className="absolute top-[10px] left-[30px] w-[2px] h-[2px] bg-white/30 rounded-full animate-pulse" style={{ animationDuration: '4s', animationDelay: '0.3s' }}></div>
            </div>

            <div className={`absolute inset-0 rounded-full overflow-hidden transition-opacity duration-500 ${isDark ? 'opacity-0' : 'opacity-100'}`}>
                <div className="absolute top-[9px] right-[12px] w-[6px] h-[4px] bg-white/40 rounded-full"></div>
                <div className="absolute bottom-[10px] right-[20px] w-[8px] h-[4px] bg-white/30 rounded-full"></div>
            </div>

            {/* Sliding knob */}
            <div
                className={`relative z-10 flex items-center justify-center w-[28px] h-[28px] rounded-full bg-white shadow-md transition-all duration-500 ease-[cubic-bezier(0.68,-0.15,0.265,1.35)] ${
                    isDark ? 'translate-x-[34px]' : 'translate-x-0'
                } group-hover:shadow-lg group-active:scale-90`}
            >
                {/* Sun icon */}
                <svg
                    className={`absolute w-[16px] h-[16px] transition-all duration-400 ${
                        isDark ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'
                    }`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <circle cx="12" cy="12" r="4" fill="#f59e0b" />
                    <line x1="12" y1="1" x2="12" y2="4" />
                    <line x1="12" y1="20" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" />
                    <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="4" y2="12" />
                    <line x1="20" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
                    <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
                </svg>

                {/* Moon icon */}
                <svg
                    className={`absolute w-[16px] h-[16px] transition-all duration-400 ${
                        isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'
                    }`}
                    viewBox="0 0 24 24"
                    fill="#818cf8"
                    stroke="#818cf8"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
            </div>
        </button>
    );
};

export default ThemeToggle;
