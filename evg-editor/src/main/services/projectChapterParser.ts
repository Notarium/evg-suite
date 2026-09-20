import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ChapterFragmentSummary, ChapterSummary } from '../../shared/chapter'

function stripBom(content: string): string {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseFragment(value: unknown, fileName: string, index: number): ChapterFragmentSummary {
  if (!isRecord(value)) {
    throw new Error(`章节文件 ${fileName} 的第 ${index + 1} 个 fragment 不是对象`)
  }

  const { id, name } = value

  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new Error(`章节文件 ${fileName} 的第 ${index + 1} 个 fragment 缺少有效的 id`)
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error(`章节文件 ${fileName} 的第 ${index + 1} 个 fragment 缺少有效的 name`)
  }

  // 章节入口片段（name === 'main'）打标记；片段调用选择器会过滤它。
  return { id, name, isMain: name === 'main' }
}

function parseChapter(value: unknown, fileName: string): ChapterSummary {
  if (!isRecord(value)) {
    throw new Error(`章节文件 ${fileName} 根节点必须是对象`)
  }

  const { id, name, fragments } = value

  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new Error(`章节文件 ${fileName} 缺少有效的 id`)
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error(`章节文件 ${fileName} 缺少有效的 name`)
  }
  if (!Array.isArray(fragments)) {
    throw new Error(`章节文件 ${fileName} 缺少 fragments 数组`)
  }

  const mainFragment = fragments.find(
    (fragment) => isRecord(fragment) && fragment.name === 'main'
  )

  if (!isRecord(mainFragment)) {
    throw new Error(`章节文件 ${fileName} 缺少 name 为 main 的 fragment`)
  }

  const blocks = mainFragment.blocks

  if (!Array.isArray(blocks) || blocks.length === 0) {
    throw new Error(`章节文件 ${fileName} 的 main fragment 缺少 blocks`)
  }

  const firstBlock = blocks[0]

  if (!isRecord(firstBlock) || firstBlock.type !== 'scene') {
    throw new Error(
      `章节文件 ${fileName} 的 main fragment 第一个 block 必须是 scene`
    )
  }

  const firstBlockProps = isRecord(firstBlock.props) ? firstBlock.props : null
  const sceneIdValue = firstBlockProps?.sceneId
  const sceneId = typeof sceneIdValue === 'string' ? sceneIdValue.trim() : ''

  if (!sceneId) {
    throw new Error(
      `章节文件 ${fileName} 的 main fragment 第一个 scene block 缺少 sceneId`
    )
  }

  return {
    id,
    name,
    sceneId,
    fragments: fragments.map((fragment, index) => parseFragment(fragment, fileName, index))
  }
}

interface ChapterOrderInfo {
  treeIndex: Map<string, number>
  nameIndex: Map<string, number>
}

async function readChapterOrder(projectPath: string): Promise<ChapterOrderInfo> {
  const treeIndex = new Map<string, number>()
  const nameIndex = new Map<string, number>()

  try {
    const projectPathFile = resolve(projectPath, 'project.json')
    const raw = await readFile(projectPathFile, 'utf8')
    const parsed: unknown = JSON.parse(stripBom(raw))

    if (!isRecord(parsed)) return { treeIndex, nameIndex }

    const treeOrder = parsed.chapterTreeOrder
    if (Array.isArray(treeOrder)) {
      treeOrder.forEach((entry, index) => {
        if (isRecord(entry) && entry.type === 'chapter') {
          const id = entry.id
          if (typeof id === 'string' && id.trim().length > 0) {
            treeIndex.set(id, index)
          }
        }
      })
    }

    const chapterOrder = parsed.chapterOrder
    if (Array.isArray(chapterOrder)) {
      chapterOrder.forEach((entry, index) => {
        if (typeof entry === 'string' && entry.trim().length > 0) {
          nameIndex.set(entry, index)
        }
      })
    }
  } catch {
    // project.json 不可读时回退到 chapters/ 文件顺序。
  }

  return { treeIndex, nameIndex }
}

function compareChapterSummaries(
  a: ChapterSummary,
  b: ChapterSummary,
  order: ChapterOrderInfo
): number {
  const aTree = order.treeIndex.get(a.id)
  const bTree = order.treeIndex.get(b.id)

  if (aTree !== undefined || bTree !== undefined) {
    if (aTree === undefined) return 1
    if (bTree === undefined) return -1
    if (aTree !== bTree) return aTree - bTree
  }

  const aName = order.nameIndex.get(a.name)
  const bName = order.nameIndex.get(b.name)

  if (aName !== undefined || bName !== undefined) {
    if (aName === undefined) return 1
    if (bName === undefined) return -1
    if (aName !== bName) return aName - bName
  }

  return 0
}

export async function parseChapterSummaries(projectPath: string): Promise<ChapterSummary[]> {
  const absoluteProjectPath = resolve(projectPath)
  const chaptersPath = resolve(absoluteProjectPath, 'chapters')
  let entries

  try {
    entries = await readdir(chaptersPath, { withFileTypes: true })
  } catch {
    throw new Error(`找不到章节目录：${chaptersPath}`)
  }

  const fileNames = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .map((entry) => entry.name)
    .sort()

  const chapters = await Promise.all(
    fileNames.map(async (fileName) => {
      const filePath = resolve(chaptersPath, fileName)
      const raw = await readFile(filePath, 'utf8')
      let parsed: unknown

      try {
        parsed = JSON.parse(stripBom(raw))
      } catch {
        throw new Error(`章节文件不是合法的 JSON：${fileName}`)
      }

      return parseChapter(parsed, fileName)
    })
  )

  const order = await readChapterOrder(absoluteProjectPath)
  return chapters.sort((a, b) => compareChapterSummaries(a, b, order))
}
