import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ProjectStructureIssue, ProjectStructureValidation } from '../../shared/project'
import {
  REQUIRED_PROJECT_DIRECTORIES,
  REQUIRED_ROOT_JSON_FILES,
  RUNTIME_EXTENSION_ID,
  runtimeExtensionManifestPath
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

/**
 * 警示级问题：不阻止打开项目，只提示。放在 issues 里返回（上层展示），
 * 但不计入 valid 的判定。
 */
function warning(code: string, path: string, message: string): ProjectStructureIssue {
  return { code: `warning-${code}`, path, message }
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

  // EVG Runtime 扩展快照：缺失 / 异常只警示，不拦截打开——编辑器编辑
  // 数据本身不依赖扩展安装，但数据行最终要靠扩展在引擎里运行。
  const warnings: ProjectStructureIssue[] = []
  const manifestPath = runtimeExtensionManifestPath(rootPath)
  const manifestRaw = (await isFile(manifestPath))
    ? stripBom(await readFile(manifestPath, 'utf8'))
    : null

  if (manifestRaw === null) {
    warnings.push(
      warning(
        'runtime-extension-missing',
        `extensions/${RUNTIME_EXTENSION_ID}/extension.json`,
        '未安装 EVG Runtime 扩展（extensions/com.notarium.evg-runtime/）——地点 / 时间 / 物品等 EVG 功能需要它才能在引擎中运行'
      )
    )
  } else {
    try {
      const manifest = JSON.parse(manifestRaw) as { id?: unknown }
      if (manifest.id !== RUNTIME_EXTENSION_ID) {
        warnings.push(
          warning(
            'runtime-extension-id-mismatch',
            `extensions/${RUNTIME_EXTENSION_ID}/extension.json`,
            `扩展快照的 id（${String(manifest.id)}）与目录名不一致，可能安装不完整`
          )
        )
      }
    } catch {
      warnings.push(
        warning(
          'runtime-extension-invalid',
          `extensions/${RUNTIME_EXTENSION_ID}/extension.json`,
          'EVG Runtime 扩展的 extension.json 无法解析，可能安装不完整'
        )
      )
    }
  }

  // project.variables.json 由引擎在用户设置变量时创建；缺失 = 引擎端
  // 还没设置过变量，提醒作者去引擎端操作（变量页会同步锁定并引导）。
  if (!(await isFile(resolve(rootPath, 'project.variables.json')))) {
    warnings.push(
      warning(
        'variables-file-missing',
        'project.variables.json',
        '工程还没有 project.variables.json——请先在引擎编辑器里设置至少一个变量（该文件由引擎创建），EVG 变量页才能编辑'
      )
    )
  }

  return {
    // warning 不计入 valid：缺失扩展 / 变量文件只是提示，不阻止打开编辑
    valid: issues.length === 0,
    issues: [...issues, ...warnings]
  }
}
