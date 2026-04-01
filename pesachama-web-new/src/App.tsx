import { Toaster } from 'sonner'
import { Analytics } from '@vercel/analytics/react'
import { ThemeProvider } from './context/ThemeContext'
import { AppRoutes } from './routes/AppRoutes'
import { useBrowserNotifications } from './bootstrap/browserNotifications'

function App() {
  useBrowserNotifications()

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Toaster richColors position="top-right" closeButton />
      <Analytics />
      <AppRoutes />
    </ThemeProvider>
  )
}

export default App
