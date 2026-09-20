export interface ChapterFragmentSummary {
  id: string
  name: string
  /** 章节入口片段（name === 'main'）；片段调用不应指向它。 */
  isMain?: boolean
}

export interface ChapterSummary {
  id: string
  name: string
  /** main fragment 第一个 scene block 的 props.sceneId。 */
  sceneId: string
  fragments: ChapterFragmentSummary[]
}
