import { useEffect } from 'react'

let hasInitializedNotifications = false

const urlB64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

async function registerServiceWorker(vapidKey?: string) {
  if (!('serviceWorker' in navigator)) return
  if (!import.meta.env.PROD) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))
    return
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js')

    if (!('PushManager' in window)) return
    if (!vapidKey) {
      return
    }

    const existingSubscription = await registration.pushManager.getSubscription()
    const subscription = existingSubscription ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(vapidKey),
    })

    void subscription
  } catch (error) {
    console.error('Service worker or push setup failed', error)
  }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return
  if (Notification.permission === 'granted' || Notification.permission === 'denied') return

  const permission = await Notification.requestPermission()

  if (permission === 'granted') {
    new Notification('Welcome to Ratibu!', {
      body: 'You will now receive important updates.',
      icon: '/ratibu-logo.png',
    })
  }
}

export function useBrowserNotifications() {
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

  useEffect(() => {
    if (hasInitializedNotifications) return
    hasInitializedNotifications = true

    void registerServiceWorker(vapidKey)
    void requestNotificationPermission()

    const handleOnline = () => {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Back Online', {
          body: 'Your connection has been restored.',
          icon: '/ratibu-logo.png',
        })
      }
    }

    const handleOffline = () => undefined

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [vapidKey])
}
