import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import type { ProjectResolution, ProjectSummary } from '../../shared/project'
import { PROJECT_MANIFEST_FILENAME } from './projectStructure'

interface ProjectManifest {
  id: string
  name: string
  resolution?: ProjectResolution
}

function stripBom(content: string): string {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
}

function parseProjectManifest(raw: string): ProjectManifest {
  let parsed: unknown

  try {
    parsed = JSON.parse(stripBom(raw))
  } catch {
    throw new Error(`${PROJECT_MANIFEST_FILENAME} 不是合法的 JSON 文件`)
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${PROJECT_MANIFEST_FILENAME} 根节点必须是对象`)
  }

  const manifest = parsed as Record<string, unknown>
  const id = typeof manifest.id === 'string' ? manifest.id.trim() : ''
  const name = typeof manifest.name === 'string' ? manifest.name.trim() : ''

  if (!id) throw new Error(`${PROJECT_MANIFEST_FILENAME} 缺少有效的 id 字段`)
  if (!name) throw new Error(`${PROJECT_MANIFEST_FILENAME} 缺少有效的 name 字段`)

  let resolution: ProjectResolution | undefined
  const rawResolution = manifest.resolution

  if (typeof rawResolution === 'object' && rawResolution !== null) {
    const candidate = rawResolution as Record<string, unknown>
    const width = candidate.width
    const height = candidate.height

    if (
      typeof width === 'number' &&
      Number.isFinite(width) &&
      width > 0 &&
      typeof height === 'number' &&
      Number.isFinite(height) &&
      height > 0
    ) {
      resolution = { width, height }
    }
  }

  return { id, name, resolution }
}

function createRecordId(manifest: ProjectManifest, folderName: string, absolutePath: string): string {
  const identity = [manifest.id, manifest.name, folderName, absolutePath].join('\n')
  return createHash('sha1').update(identity).digest('hex')
}

export async function parseProjectSummary(rawPath: string): Promise<ProjectSummary> {
  const absolutePath = resolve(rawPath)
  const manifestPath = resolve(absolutePath, PROJECT_MANIFEST_FILENAME)
  const manifest = parseProjectManifest(await readFile(manifestPath, 'utf8'))
  const folderName = basename(absolutePath) || absolutePath

  return {
    id: createRecordId(manifest, folderName, absolutePath),
    projectId: manifest.id,
    name: manifest.name,
    folderName,
    path: absolutePath,
    resolution: manifest.resolution
  }
}
