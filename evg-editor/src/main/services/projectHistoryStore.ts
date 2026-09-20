import { readFile } from 'node:fs/promises'
import type { ProjectRecord } from '../../shared/project'
import { writeJsonFileAtomic } from './projectFileWriter'

const HISTORY_VERSION = 1

export interface ProjectHistoryStoreOptions {
  maxEntries?: number
}

function isProjectRecord(value: unknown): value is ProjectRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Partial<Record<keyof ProjectRecord, unknown>>
  return (
    typeof record.id === 'string' &&
    typeof record.projectId === 'string' &&
    typeof record.name === 'string' &&
    typeof record.folderName === 'string' &&
    typeof record.path === 'string' &&
    typeof record.lastOpenedAt === 'string'
  )
}

function parseHistory(raw: string): ProjectRecord[] {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return []

    const projects = (parsed as { projects?: unknown }).projects
    if (!Array.isArray(projects)) return []

    return projects.filter(isProjectRecord)
  } catch {
    return []
  }
}

export class ProjectHistoryStore {
  private readonly maxEntries: number

  constructor(
    private readonly filePath: string,
    options: ProjectHistoryStoreOptions = {}
  ) {
    this.maxEntries = Math.max(1, options.maxEntries ?? 30)
  }

  async list(): Promise<ProjectRecord[]> {
    try {
      const raw = await readFile(this.filePath, 'utf8')
      return parseHistory(raw)
        .sort((left, right) => right.lastOpenedAt.localeCompare(left.lastOpenedAt))
        .slice(0, this.maxEntries)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
  }

  async upsert(project: ProjectRecord): Promise<ProjectRecord[]> {
    const projects = await this.list()
    const nextProjects = [
      project,
      ...projects.filter((item) => item.path !== project.path)
    ].slice(0, this.maxEntries)

    await this.save(nextProjects)
    return nextProjects
  }

  async remove(id: string): Promise<ProjectRecord[]> {
    const projects = await this.list()
    const nextProjects = projects.filter((project) => project.id !== id)
    await this.save(nextProjects)
    return nextProjects
  }

  async clear(): Promise<ProjectRecord[]> {
    await this.save([])
    return []
  }

  private async save(projects: ProjectRecord[]): Promise<void> {
    await writeJsonFileAtomic(this.filePath, {
      version: HISTORY_VERSION,
      projects
    })
  }
}
