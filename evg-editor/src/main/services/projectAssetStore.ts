import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif'
}

const MAX_ASSET_BYTES = 32 * 1024 * 1024

export async function readProjectAssetDataUrl(
  projectPath: string,
  assetPath: string
): Promise<string> {
  if (typeof assetPath !== 'string' || assetPath.trim().length === 0) {
    throw new Error('无效的资源路径')
  }

  const assetsRoot = resolve(projectPath, 'assets')
  const filePath = resolve(assetsRoot, assetPath)

  if (filePath !== assetsRoot && !filePath.startsWith(assetsRoot + sep)) {
    throw new Error('资源路径越界')
  }

  const data = await readFile(filePath)

  if (data.byteLength > MAX_ASSET_BYTES) {
    throw new Error('资源文件过大，暂时无法预览')
  }

  const extension = extname(filePath).toLowerCase()
  const mimeType = MIME_TYPES[extension] ?? 'application/octet-stream'

  return `data:${mimeType};base64,${data.toString('base64')}`
}
