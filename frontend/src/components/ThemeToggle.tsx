import { Moon, Sun } from 'lucide-react'
import { useApp } from '@/app/state'

export function ThemeToggle() {
  const { theme, toggleTheme } = useApp()
  const dark = theme === 'dark'
  return (
    <button
      onClick={toggleTheme}
      aria-label={dark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
      title={dark ? 'Chế độ sáng' : 'Chế độ tối'}
      className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-600 transition-colors hover:bg-line-100 hover:text-ink-900"
    >
      {dark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  )
}
