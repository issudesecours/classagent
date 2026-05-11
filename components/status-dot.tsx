import clsx from 'clsx'

interface StatusDotProps {
  status: 'online' | 'offline' | 'busy'
  size?: 'sm' | 'md'
  label?: string
}

const statusColors: Record<StatusDotProps['status'], string> = {
  online: 'bg-green-500',
  offline: 'bg-zinc-400',
  busy: 'bg-amber-500',
}

const pulseColors: Record<StatusDotProps['status'], string> = {
  online: 'bg-green-400',
  offline: '',
  busy: '',
}

export function StatusDot({ status, size = 'md', label }: StatusDotProps) {
  let dotSize = size === 'sm' ? 'size-2' : 'size-2.5'

  return (
    <span className="inline-flex items-center gap-2">
      <span className={clsx('relative flex', dotSize)}>
        {status === 'online' && (
          <span
            className={clsx(
              'absolute inline-flex size-full animate-ping rounded-full opacity-75',
              pulseColors[status]
            )}
          />
        )}
        <span className={clsx('relative inline-flex rounded-full', dotSize, statusColors[status])} />
      </span>
      {label && (
        <span
          className={clsx(
            'font-medium text-zinc-700 dark:text-zinc-300',
            size === 'sm' ? 'text-xs' : 'text-sm'
          )}
        >
          {label}
        </span>
      )}
    </span>
  )
}
