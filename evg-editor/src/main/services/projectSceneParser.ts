import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { SceneLayerSummary, SceneSummary } from '../../shared/scene'

const SCENES_FILENAME = 'scenes.json'

function stripBom(content: string): string {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseLayer(value: unknown, index: number): SceneLayerSummary {
  if (!isRecord(value)) {
    throw new Error(`第 ${index + 1} 个 scene layer 不是对象`)
  }

  const { id, name, assetPath, distance } = value

  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new Error(`第 ${index + 1} 个 scene layer 缺少有效的 id`)
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error(`第 ${index + 1} 个 scene layer 缺少有效的 name`)
  }
  if (typeof assetPath !== 'string' || assetPath.trim().length === 0) {
    throw new Error(`第 ${index + 1} 个 scene layer 缺少有效的 assetPath`)
  }

  return {
    id,
    name,
    assetPath,
    distance: typeof distance === 'number' && Number.isFinite(distance)
      ? distance
      : undefined
  }
}

function parseScene(value: unknown, index: number): SceneSummary {
  if (!isRecord(value)) {
    throw new Error(`第 ${index + 1} 个 scene 不是对象`)
  }

  const { id, name, layers } = value

  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new Error(`第 ${index + 1} 个 scene 缺少有效的 id`)
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error(`第 ${index + 1} 个 scene 缺少有效的 name`)
  }
  if (!Array.isArray(layers)) {
    throw new Error(`第 ${index + 1} 个 scene 缺少 layers 数组`)
  }

  return {
    id,
    name,
    layers: layers.map((layer, layerIndex) => parseLayer(layer, layerIndex))
  }
}

export async function parseSceneSummaries(projectPath: string): Promise<SceneSummary[]> {
  const scenesPath = resolve(projectPath, SCENES_FILENAME)
  const raw = await readFile(scenesPath, 'utf8')
  let parsed: unknown

  try {
    parsed = JSON.parse(stripBom(raw))
  } catch {
    throw new Error(`${SCENES_FILENAME} 不是合法的 JSON 文件`)
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.scenes)) {
    throw new Error(`${SCENES_FILENAME} 缺少 scenes 数组`)
  }

  return parsed.scenes.map((scene, index) => parseScene(scene, index))
}
