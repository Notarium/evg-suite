import { dialog, type BrowserWindow } from 'electron'
import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ProjectRecord, ProjectStructureIssue, ProjectSummary } from '../../shared/project'
import { ProjectHistoryStore } from './projectHistoryStore'
import { parseProjectSummary } from './projectSummaryParser'
import { validateProjectStructure } from './projectValidator'

function formatValidationIssues(issues: ProjectStructureIssue[]): string {
  const details = issues.map((issue) => `- ${issue.message}`).join('\n')
  return `项目结构校验失败：\n${details}`
}

export class ProjectService {
  constructor(private readonly historyStore: ProjectHistoryStore) {}

  list(): Promise<ProjectRecord[]> {
    return this.historyStore.list()
  }

  async openProject(parentWindow: BrowserWindow | null): Promise<ProjectRecord | null> {
    const options = {
      title: '选择项目目录',
      buttonLabel: '打开项目',
      properties: ['openDirectory' as const]
    }

    const result = parentWindow
      ? await dialog.showOpenDialog(parentWindow, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || result.filePaths.length === 0) return null

    return this.registerProject(result.filePaths[0])
  }

  async openRecent(id: string): Promise<ProjectRecord> {
    const projects = await this.historyStore.list()
    const existingProject = projects.find((item) => item.id === id)

    if (!existingProject) throw new Error('项目历史不存在，可能已被移除')

    const stats = await stat(existingProject.path).catch(() => null)
    if (!stats?.isDirectory()) {
      await this.historyStore.remove(existingProject.id)
      throw new Error('项目目录已不存在，已从历史记录中移除')
    }

    const summary = await this.loadProjectSummary(existingProject.path)
    const updatedProject: ProjectRecord = {
      ...summary,
      lastOpenedAt: new Date().toISOString()
    }

    await this.historyStore.upsert(updatedProject)
    return updatedProject
  }

  async reload(id: string): Promise<ProjectRecord> {
    const projects = await this.historyStore.list()
    const existingProject = projects.find((item) => item.id === id)

    if (!existingProject) throw new Error('项目历史不存在，可能已被移除')

    const stats = await stat(existingProject.path).catch(() => null)
    if (!stats?.isDirectory()) {
      await this.historyStore.remove(existingProject.id)
      throw new Error('项目目录已不存在，已从历史记录中移除')
    }

    const summary = await this.loadProjectSummary(existingProject.path)
    return {
      ...summary,
      lastOpenedAt: existingProject.lastOpenedAt
    }
  }

  remove(id: string): Promise<ProjectRecord[]> {
    return this.historyStore.remove(id)
  }

  clear(): Promise<ProjectRecord[]> {
    return this.historyStore.clear()
  }

  private async registerProject(rawPath: string): Promise<ProjectRecord> {
    const absolutePath = resolve(rawPath)
    const stats = await stat(absolutePath).catch(() => null)

    if (!stats?.isDirectory()) {
      throw new Error('选择的路径不是有效目录')
    }

    const summary = await this.loadProjectSummary(absolutePath)
    const project: ProjectRecord = {
      ...summary,
      lastOpenedAt: new Date().toISOString()
    }

    await this.historyStore.upsert(project)
    return project
  }

  private async loadProjectSummary(rootPath: string): Promise<ProjectSummary> {
    const validation = await validateProjectStructure(rootPath)

    if (!validation.valid) {
      throw new Error(formatValidationIssues(validation.issues))
    }

    return parseProjectSummary(rootPath)
  }
}
