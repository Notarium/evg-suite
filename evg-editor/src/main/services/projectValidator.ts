import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ProjectStructureIssue, ProjectStructureValidation } from '../../shared/project'
import {
  REQUIRED_PROJECT_DIRECTORIES,
  REQUIRED_ROOT_JSON_FILES
} from './projectStructure'

function stripBom(content: string): string {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
}

async function isDirectory(path: string): Promise<boolean> {
  const stats = await stat(path).catch(() => null)
  return Boolean(stats?.isDirectory())
}

async function isFile(path: string): Promise<boolean> {
  const stats = await stat(path).catch(() => null)
  return Boolean(stats?.isFile())
}

function issue(code: string, path: string, message: string): ProjectStructureIssue {
  return { code, path, message }
}

export async function validateProjectStructure(rawPath: string): Promise<ProjectStructureValidation> {
  const rootPath = resolve(rawPath)
  const issues: ProjectStructureIssue[] = []
  const rootStats = await stat(rootPath).catch(() => null)

  if (!rootStats?.isDirectory()) {
    return {
      valid: false,
      issues: [issue('invalid-project-root', rootPath, '项目路径不是一个有效目录')]
    }
  }

  for (const directory of REQUIRED_PROJECT_DIRECTORIES) {
    if (!(await isDirectory(resolve(rootPath, directory)))) {
      issues.push(
        issue('missing-directory', directory, `缺少必需文件夹：${directory}/`)
      )
    }
  }

  for (const fileName of REQUIRED_ROOT_JSON_FILES) {
    const filePath = resolve(rootPath, fileName)

    if (!(await isFile(filePath))) {
      issues.push(issue('missing-json-file', fileName, `缺少必需 JSON 文件：${fileName}`))
      continue
    }

    try {
      JSON.parse(stripBom(await readFile(filePath, 'utf8')))
    } catch {
      issues.push(issue('invalid-json-file', fileName, `JSON 文件无法解析：${fileName}`))
    }
  }

  return {
    valid: issues.length === 0,
    issues
  }
}
