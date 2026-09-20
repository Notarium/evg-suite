import { resolve } from 'node:path'

export const PROJECT_MANIFEST_FILENAME = 'project.json'

/**
 * 必须存在的项目目录。
 *
 * 素材目录使用 `assets/`（全小写复数）；`asset/` 不是有效目录名。
 */
export const REQUIRED_PROJECT_DIRECTORIES = ['assets', 'chapters', 'databases'] as const

/**
 * 根目录必须存在的 JSON 文件。
 *
 * - `extensions.json` 不是必需项：新式工程里它是遗留聚合文件（内容常为
 *   `{}`），扩展以 `extensions/<扩展id>/extension.json` 目录形态存在；
 * - `project.variables.json` 不是必需项：它是本编辑器自己的存储（引擎
 *   不认识），引擎新建的工程没有它，编辑器首次保存变量时创建。
 *
 * 修改工程结构要求时，优先改这里，并同步更新 AGENTS.md。
 */
export const REQUIRED_ROOT_JSON_FILES = [
  'project.json',
  'characters.json',
  'scenes.json'
] as const

/** EVG Runtime 扩展在工程内的快照路径（extensions/<id>/extension.json）。 */
export const RUNTIME_EXTENSION_ID = 'com.notarium.evg-runtime'

export function runtimeExtensionManifestPath(rootPath: string): string {
  return resolve(rootPath, 'extensions', RUNTIME_EXTENSION_ID, 'extension.json')
}
