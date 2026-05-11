import clsx from 'clsx'
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/20/solid'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: { value: number; direction: 'up' | 'down' }
  icon?: React.ReactNode
}

export function StatCard({ title, value, subtitle, trend, icon }: StatCardProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-6 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-white">{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
          )}
          {trend && (
            <div
              className={clsx(
                'mt-2 inline-flex items-center gap-1 text-sm font-medium',
                trend.direction === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              )}
            >
              {trend.direction === 'up' ? (
                <ArrowTrendingUpIcon className="size-4" />
              ) : (
                <ArrowTrendingDownIcon className="size-4" />
              )}
              <span>{trend.value}%</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sahrai-50 text-sahrai-600 dark:bg-sahrai-900/30 dark:text-sahrai-400">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
