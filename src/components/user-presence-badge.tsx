import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatLastSeen, formatFullDateTime } from '@/hooks/use-user-presence'
import { Clock, Circle } from 'lucide-react'

interface UserPresenceBadgeProps {
  isOnline: boolean
  lastSeenAt: string | null
  lastActivityAt: string | null
  showFullDetails?: boolean
}

export function UserPresenceBadge({
  isOnline,
  lastSeenAt,
  lastActivityAt,
  showFullDetails = false,
}: UserPresenceBadgeProps) {
  const lastSeenText = formatLastSeen(lastSeenAt)
  const fullDateTime = formatFullDateTime(lastActivityAt || lastSeenAt)

  if (showFullDetails) {
    return (
      <div className="flex flex-col gap-1 text-sm">
        <div className="flex items-center gap-2">
          <Circle
            className={`h-2.5 w-2.5 ${isOnline ? 'fill-green-500 text-green-500' : 'fill-gray-400 text-gray-400'}`}
          />
          <span className={isOnline ? 'text-green-600 font-medium' : 'text-gray-500'}>
            {isOnline ? 'En ligne' : 'Hors ligne'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <Clock className="h-3.5 w-3.5" />
          <span className="text-xs">{lastSeenText}</span>
        </div>
        <div className="text-xs text-gray-400">
          Dernière activité: {fullDateTime}
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <Circle
              className={`h-2.5 w-2.5 ${isOnline ? 'fill-green-500 text-green-500' : 'fill-gray-400 text-gray-400'}`}
            />
            <Badge
              variant={isOnline ? 'default' : 'secondary'}
              className={isOnline ? 'bg-green-100 text-green-700 hover:bg-green-200' : ''}
            >
              {isOnline ? 'En ligne' : 'Hors ligne'}
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{isOnline ? 'Utilisateur en ligne' : 'Utilisateur hors ligne'}</p>
            <p className="text-xs text-gray-500">{lastSeenText}</p>
            <p className="text-xs text-gray-400">Dernière activité: {fullDateTime}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
