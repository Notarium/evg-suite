import { useEffect, useState } from 'react'

interface AssetUrlState {
  url: string | null
  loading: boolean
  error: string | null
}

const assetUrlCache = new Map<string, string>()

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '资源读取失败'
}

export function useAssetUrl(
  projectPath: string | null,
  assetPath: string | null
): AssetUrlState {
  const key = projectPath && assetPath ? `${projectPath}\n${assetPath}` : null
  const [state, setState] = useState<AssetUrlState>(() => {
    const cached = key ? assetUrlCache.get(key) ?? null : null
    return { url: cached, loading: false, error: null }
  })

  useEffect(() => {
    if (!key) {
      setState({ url: null, loading: false, error: null })
      return
    }

    const existing = assetUrlCache.get(key)
    if (existing) {
      setState({ url: existing, loading: false, error: null })
      return
    }

    let cancelled = false
    setState({ url: null, loading: true, error: null })

    const api = window.api?.assets
    if (!api) {
      setState({
        url: null,
        loading: false,
        error: '当前运行环境未注入 assets API，请重启应用'
      })
      return
    }

    void api
      .read(projectPath as string, assetPath as string)
      .then((result) => {
        if (cancelled) return

        if (!result.ok) {
          setState({ url: null, loading: false, error: result.error })
          return
        }

        assetUrlCache.set(key, result.data)
        setState({ url: result.data, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState({
          url: null,
          loading: false,
          error: getErrorMessage(error)
        })
      })

    return () => {
      cancelled = true
    }
  }, [key, projectPath, assetPath])

  return state
}
