import type { ReactNode } from 'react'
import {
  ConditionIcon,
  ActionIcon,
  EventIcon,
  HomeIcon,
  PanelLeftIcon,
  RuntimeConfigIcon,
  SceneIcon,
  SettingsIcon,
  VariablesIcon
} from './Icons'
import { useAppStore, type PageKey } from '../stores/useAppStore'

interface NavItem {
  key: PageKey
  label: string
  description: string
  icon: ReactNode
}

const NAV_ITEMS: NavItem[] = [
  {
    key: 'home',
    label: '首页',
    description: '最近项目',
    icon: <HomeIcon />
  },
  {
    key: 'variables',
    label: '变量',
    description: '变量与属性',
    icon: <VariablesIcon />
  },
  {
    key: 'conditions',
    label: '条件',
    description: '条件定义',
    icon: <ConditionIcon />
  },
  {
    key: 'actions',
    label: '动作',
    description: '动作定义',
    icon: <ActionIcon />
  },
  {
    key: 'events',
    label: '事件',
    description: '事件定义',
    icon: <EventIcon />
  },
  {
    key: 'locations',
    label: '地点',
    description: '地点与热点',
    icon: <SceneIcon />
  },
  {
    key: 'runtime',
    label: '运行配置',
    description: '运行数据配置',
    icon: <RuntimeConfigIcon />
  }
]

export function Sidebar() {
  const activePage = useAppStore((state) => state.activePage)
  const setActivePage = useAppStore((state) => state.setActivePage)
  const currentProject = useAppStore((state) => state.currentProject)
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useAppStore((state) => state.toggleSidebar)

  return (
    <aside className={`sidebar${sidebarCollapsed ? ' sidebar--collapsed' : ''}`}>
      <div className="sidebar__head">
        <span className="sidebar__head-label">导航</span>
        <button
          type="button"
          className="sidebar__collapse-button"
          aria-label={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
          title={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
          onClick={() => toggleSidebar()}
        >
          <PanelLeftIcon />
        </button>
      </div>

      <nav className="sidebar__nav" aria-label="主导航">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`nav-button${activePage === item.key ? ' nav-button--active' : ''}`}
            title={item.label}
            onClick={() => setActivePage(item.key)}
          >
            <span className="nav-button__icon">{item.icon}</span>
            <span className="nav-button__copy">
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </span>
          </button>
        ))}
      </nav>

      <div className="sidebar__bottom">
        <button
          type="button"
          className={`nav-button${activePage === 'settings' ? ' nav-button--active' : ''}`}
          title="设置"
          onClick={() => setActivePage('settings')}
        >
          <span className="nav-button__icon">
            <SettingsIcon />
          </span>
          <span className="nav-button__copy">
            <strong>设置</strong>
            <small>应用偏好</small>
          </span>
        </button>

        <div className="sidebar__footer">
          <span className="sidebar__footer-label">当前项目</span>
          {currentProject ? (
            <>
              <strong
                className="sidebar__project-name"
                title={currentProject.path}
              >
                {currentProject.name}
              </strong>
              <span className="sidebar__project-path" title={currentProject.path}>
                {currentProject.path}
              </span>
            </>
          ) : (
            <span className="sidebar__project-empty">尚未打开项目</span>
          )}
        </div>
      </div>
    </aside>
  )
}
