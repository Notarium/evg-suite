export function formatRelativeTime(input: string): string {
  const date = new Date(input)

  if (Number.isNaN(date.getTime())) {
    return '未知时间'
  }

  const diffInMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000))

  if (diffInMinutes < 1) return '刚刚'
  if (diffInMinutes < 60) return `${diffInMinutes} 分钟前`

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours} 小时前`

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 30) return `${diffInDays} 天前`

  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
