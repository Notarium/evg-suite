import { mkdir, rename, writeFile, stat } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'

const projectWriteQueues = new Map<string, Promise<unknown>>()

/**
 * 项目文件写入器 —— 整个主进程唯一允许落盘项目文件的地方。
 *
 * 写入安全模型（按调用方能力收紧，而不是靠调用方自觉）：
 * - **白名单**：只有登记过的相对路径可以被写入（如 project.variables.json、
 *   characters.json、databases/ 下的 collection）。白名单外的路径一律拒绝，
 *   顺便防目录穿越（.. / 绝对路径都到不了磁盘）。
 * - **create 权限**：每个白名单条目单独声明允许"创建新文件"。引擎新建的
 *   工程没有 project.variables.json（由引擎在用户设置变量时创建），这类
 *   文件必须 `create: false`——文件不存在时写入直接抛错，绝不凭空生成。
 * - **原子写**：写临时文件后 rename，避免半截文件。
 * - **项目级写锁**：同项目的写操作串行，防止 read-modify-write 互相覆盖。
 *
 * 读没有对应限制：项目文件可以随意读取。
 *
 * 编辑器自身的数据（如最近项目历史，写在 Electron userData）不属于用户
 * 项目，走 `writeJsonFileAtomic` 直通通道，不受白名单约束。
 */

/** 项目内可写文件的登记条目。 */
export interface ProjectWritableEntry {
  /** 相对项目根的路径，使用 posix 分隔符（如 'project.variables.json'）。 */
  relativePath: string
  /** 是否允许创建新文件；false = 文件必须已存在，否则写入抛错。 */
  create: boolean
}

export class ProjectFileWriter {
  private readonly entries = new Map<string, ProjectWritableEntry>()

  constructor(private readonly projectRoot: string) {}

  /** 登记一个可写路径。重复登记同一路径会覆盖 create 标记。 */
  register(entry: ProjectWritableEntry): this {
    this.entries.set(this.normalizeKey(entry.relativePath), entry)
    return this
  }

  /** 查询某相对路径的登记情况（不存在返回 undefined）。 */
  entry(relativePath: string): ProjectWritableEntry | undefined {
    return this.entries.get(this.normalizeKey(relativePath))
  }

  /**
   * 白名单内写入（自行取项目写锁）。路径未登记、或登记为不可创建而
   * 文件尚不存在时抛错。
   */
  async write(relativePath: string, value: unknown): Promise<void> {
    await withProjectWriteLock(this.projectRoot, () =>
      this.writeUnlocked(relativePath, value)
    )
  }

  /**
   * 白名单内写入（**不取锁**，调用方必须已持有项目写锁或在锁外）。
   * 供服务层的"锁内 read-modify-write"复用；白名单与 create 校验相同。
   */
  async writeUnlocked(relativePath: string, value: unknown): Promise<void> {
    const key = this.normalizeKey(relativePath)
    const entry = this.entries.get(key)

    if (!entry) {
      throw new Error(
        `写入被拒绝：${relativePath} 不在项目可写白名单中（ProjectFileWriter）`
      )
    }

    const absolutePath = this.toAbsolute(relativePath)

    if (!entry.create) {
      const stats = await stat(absolutePath).catch(() => null)
      if (!stats?.isFile()) {
        throw new Error(
          `写入被拒绝：${relativePath} 不存在且未授权创建（该文件由 AVG 引擎创建，` +
            '请先在引擎编辑器中设置变量后再使用本功能）'
        )
      }
    }

    await writeJsonFileAtomic(absolutePath, value)
  }

  /** 相对路径归一化成映射键：posix 分隔符、拒绝绝对路径与目录穿越。 */
  private normalizeKey(relativePath: string): string {
    if (typeof relativePath !== 'string' || relativePath === '') {
      throw new Error('写入被拒绝：路径为空')
    }
    if (relativePath.includes('\\') || relativePath.includes('..')) {
      throw new Error(`写入被拒绝：非法路径 ${relativePath}`)
    }

    const parts = relativePath.split('/')
    if (parts.some((part) => part === '' || part === '.' || part === '..')) {
      throw new Error(`写入被拒绝：非法路径 ${relativePath}`)
    }
    if (parts[0] === undefined || /^[a-zA-Z]:$/.test(parts[0])) {
      throw new Error(`写入被拒绝：非法路径 ${relativePath}`)
    }

    return parts.join('/')
  }

  /** 解析成项目内的绝对路径；解析结果逃出项目根时抛错（纵深防御）。 */
  private toAbsolute(relativePath: string): string {
    const absolute = resolve(this.projectRoot, ...relativePath.split('/'))
    const rootWithSep = resolve(this.projectRoot) + sep
    if (!absolute.startsWith(rootWithSep)) {
      throw new Error(`写入被拒绝：${relativePath} 逃出项目根目录`)
    }
    return absolute
  }
}

/** 共享的编辑器自身文件原子写（userData 历史等，非用户项目文件）。 */
export async function writeJsonFileAtomic(
  filePath: string,
  value: unknown
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })

  const tempFilePath = `${filePath}.${process.pid}.tmp`
  await writeFile(tempFilePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(tempFilePath, filePath)
}

/**
 * 项目级写锁。
 *
 * 同一个项目路径下的写操作会按调用顺序串行执行，避免
 * read-modify-write 之间互相覆盖。ProjectFileWriter.write 内部已使用；
 * 服务层有"读-改-写"跨多步的操作也可直接用它包裹。
 */
export function withProjectWriteLock<T>(
  projectPath: string,
  task: () => Promise<T>
): Promise<T> {
  const key = resolve(projectPath)
  const previous = projectWriteQueues.get(key) ?? Promise.resolve()
  const next = previous.then(task, task)

  projectWriteQueues.set(
    key,
    next.then(
      () => undefined,
      () => undefined
    )
  )

  return next
}
