'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'zenadam-admin-theme';

const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  document.body?.setAttribute('data-theme', theme);
};

export function ThemeToggle() {
  const [theme, setTheme] = useState('light');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(STORAGE_KEY) ?? 'light';
    setTheme(savedTheme);
    applyTheme(savedTheme);
    setIsMounted(true);
  }, []);

  const handleThemeChange = (nextTheme) => {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
  };

  if (!isMounted) {
    return <div className="ghost-surface h-11 w-[126px] rounded-full" />;
  }

  return (
    <div className="ghost-surface flex items-center gap-1 rounded-full p-1 text-sm">
      {['light', 'dark'].map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => handleThemeChange(option)}
          className={`rounded-full px-3 py-2 text-sm font-medium transition ${
            theme === option ? 'bg-accent text-accent-contrast shadow-[0_8px_20px_rgba(34,197,94,0.22)]' : 'text-text-muted'
          }`}
        >
          {option === 'light' ? 'Light' : 'Dark'}
        </button>
      ))}
    </div>
  );
}
