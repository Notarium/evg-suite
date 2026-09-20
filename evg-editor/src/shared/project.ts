export interface ProjectResolution {
  width: number
  height: number
}

export interface ProjectSummary {
  /**
   * 唯一记录 ID。
   * 当前由 project.json 的 id / name、项目目录名和绝对路径共同生成。
   */
  id: string
  projectId: string
  name: string
  folderName: string
  path: string
  /** project.json.resolution，用于场景预览等尺寸换算。 */
  resolution?: ProjectResolution
}

export interface ProjectRecord extends ProjectSummary {
  lastOpenedAt: string
}

export interface ProjectStructureIssue {
  code: string
  path: string
  message: string
}

export interface ProjectStructureValidation {
  valid: boolean
  issues: ProjectStructureIssue[]
}
