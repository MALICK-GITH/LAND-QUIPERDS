import { useEffect, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'

const HEARTBEAT_INTERVAL = 60000 // 1 minute
const OFFLINE_THRESHOLD = 300000 // 5 minutes of inactivity

export function useUserPresence(userId: string | null) {
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const visibilityChangeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!userId) return

    // Mark user as online when hook mounts
    const markOnline = async () => {
      try {
        await supabase.rpc('mark_user_online', { p_user_id: userId })
      } catch (error) {
        console.error('Error marking user online:', error)
      }
    }

    markOnline()

    // Set up heartbeat to keep user marked as online
    heartbeatIntervalRef.current = setInterval(() => {
      markOnline()
    }, HEARTBEAT_INTERVAL)

    // Handle visibility changes (tab hidden/shown)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        markOnline()
      }
    }

    visibilityChangeRef.current = handleVisibilityChange
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Handle page unload
    const handleUnload = async () => {
      try {
        await supabase.rpc('mark_user_offline', { p_user_id: userId })
      } catch (error) {
        console.error('Error marking user offline:', error)
      }
    }

    window.addEventListener('beforeunload', handleUnload)

    return () => {
      // Cleanup
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
      }
      if (visibilityChangeRef.current) {
        document.removeEventListener('visibilitychange', visibilityChangeRef.current)
      }
      window.removeEventListener('beforeunload', handleUnload)
      
      // Mark user offline when component unmounts
      handleUnload()
    }
  }, [userId, supabase])

  return null
}

export function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return 'Jamais connecté'

  const now = new Date()
  const lastSeen = new Date(lastSeenAt)
  const diffMs = now.getTime() - lastSeen.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) {
    return `Il y a ${diffSecs} seconde${diffSecs > 1 ? 's' : ''}`
  }

  if (diffMins < 60) {
    return `Il y a ${diffMins} minute${diffMins > 1 ? 's' : ''}`
  }

  if (diffHours < 24) {
    return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`
  }

  if (diffDays < 7) {
    return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`
  }

  // Format full date for older connections
  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }

  return lastSeen.toLocaleDateString('fr-FR', options)
}

export function formatFullDateTime(dateString: string | null): string {
  if (!dateString) return 'Non disponible'

  const date = new Date(dateString)
  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }

  return date.toLocaleDateString('fr-FR', options)
}
