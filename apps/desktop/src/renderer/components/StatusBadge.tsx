import { cn } from '../lib/utils';

export type ConnectionStatus = 'offline' | 'ready' | 'waiting' | 'connected';

interface StatusBadgeProps {
  status: ConnectionStatus;
}

const STATUS_CONFIG: Record<
  ConnectionStatus,
  { label: string; dotClass: string; textClass: string }
> = {
  offline: {
    label: 'Offline',
    dotClass: 'bg-muted-foreground',
    textClass: 'text-muted-foreground',
  },
  ready: {
    label: 'Ready',
    dotClass: 'bg-green-500',
    textClass: 'text-green-400',
  },
  waiting: {
    label: 'Waiting...',
    dotClass: 'bg-yellow-500 animate-pulse',
    textClass: 'text-yellow-400',
  },
  connected: {
    label: 'Connected',
    dotClass: 'bg-blue-500',
    textClass: 'text-blue-400',
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div className="flex items-center gap-2">
      <span className={cn('h-2.5 w-2.5 rounded-full', config.dotClass)} />
      <span className={cn('text-sm font-medium', config.textClass)}>
        {config.label}
      </span>
    </div>
  );
}
