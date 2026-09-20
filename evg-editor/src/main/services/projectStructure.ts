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
 * 修改工程结构要求时，优先改这里，并同步更新 AGENTS.md。
 */
export const REQUIRED_ROOT_JSON_FILES = [
  'project.json',
  'characters.json',
  'extensions.json',
  'project.variables.json',
  'scenes.json'
] as const
