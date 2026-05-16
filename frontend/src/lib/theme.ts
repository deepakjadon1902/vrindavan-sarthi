export type ThemeMode = 'light' | 'dark';

export const applyTheme = (mode: ThemeMode = 'dark') => {
  const root = document.documentElement;
  if (mode === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
};
