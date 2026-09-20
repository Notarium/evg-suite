export interface SceneLayerSummary {
  id: string
  name: string
  assetPath: string
  distance?: number
}

export interface SceneSummary {
  id: string
  name: string
  layers: SceneLayerSummary[]
}
