import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const projectWriteQueues = new Map<string, Promise<unknown>>()

/**
 * 所有 JSON 文件统一使用的原子写入。
 *
 * 这是整个主进程里唯一直接调用 writeFile + rename 落盘 JSON 的地方。
 */
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
 * read-modify-write 之间互相覆盖。
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
