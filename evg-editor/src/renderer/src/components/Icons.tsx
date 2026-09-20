import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number
}

function iconProps(size: number): Pick<SVGProps<SVGSVGElement>, 'width' | 'height' | 'viewBox'> & {
  fill: string
  stroke: string
  strokeWidth: number
  strokeLinecap: 'round'
  strokeLinejoin: 'round'
} {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  }
}

export function HomeIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  )
}

export function FileIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  )
}

export function SettingsIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.26.34.47.73.6 1.15" />
    </svg>
  )
}

export function FolderOpenIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M3 10h18" />
    </svg>
  )
}

export function FolderIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </svg>
  )
}

export function ClockIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export function TrashIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="m6 7 1 14h10l1-14" />
      <path d="M9 7V4h6v3" />
    </svg>
  )
}

export function ArrowRightIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}

export function MinimizeIcon({ size = 14, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <path d="M5 12h14" />
    </svg>
  )
}

export function MaximizeIcon({ size = 14, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <rect x="5" y="5" width="14" height="14" rx="1.5" />
    </svg>
  )
}

export function RestoreIcon({ size = 14, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <rect x="7" y="7" width="12" height="12" rx="1.5" />
      <path d="M5 15V5h10" />
    </svg>
  )
}

export function CloseIcon({ size = 14, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

export function SunIcon({ size = 15, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <circle cx="12" cy="12" r="3.75" />
      <path d="M12 2.5v2M12 19.5v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2.5 12h2M19.5 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

export function MoonIcon({ size = 15, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5 8.5 8.5 0 1 0 20.5 14.6Z" />
    </svg>
  )
}

export function PlusIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function PencilIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10Z" />
      <path d="m14.5 6.5 3 3" />
    </svg>
  )
}

export function ChevronRightIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

export function ChevronDownIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function VariablesIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <path d="M4 6h16" />
      <path d="M4 12h10" />
      <path d="M4 18h16" />
      <circle cx="17" cy="12" r="2" />
      <circle cx="13" cy="6" r="2" />
      <circle cx="9" cy="18" r="2" />
    </svg>
  )
}

export function RefreshIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v4h-4" />
    </svg>
  )
}

export function ConditionIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <path d="M12 3v7" />
      <path d="M12 10c0 5-7 4-7 11" />
      <path d="M12 10c0 5 7 4 7 11" />
      <circle cx="12" cy="3" r="2" />
      <circle cx="5" cy="21" r="2" />
      <circle cx="19" cy="21" r="2" />
    </svg>
  )
}

export function ActionIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <path d="M13 2 5 13h6l-1 9 9-12h-6l0-8Z" />
    </svg>
  )
}

export function EventIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <path d="M5 21V4" />
      <path d="M5 5h10.5a2 2 0 0 1 1.8 2.87l-1.1 2.13 1.1 2.13A2 2 0 0 1 15.5 15H5" />
      <path d="M5 15h12" />
    </svg>
  )
}

export function SceneIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m3 15 5-5 4 4 3-3 6 6" />
      <circle cx="15" cy="8" r="1.4" />
    </svg>
  )
}

export function PanelLeftIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <path d="M9 4v16" />
    </svg>
  )
}

export function ExpandIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <path d="M14 4h6v6" />
      <path d="M20 4l-6 6" />
      <path d="M10 20H4v-6" />
      <path d="M4 20l6-6" />
    </svg>
  )
}

export function CollapseIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <path d="M20 4l-6 6" />
      <path d="M14 10h4" />
      <path d="M14 10V6" />
      <path d="M4 20l6-6" />
      <path d="M10 14H6" />
      <path d="M10 14v4" />
    </svg>
  )
}

export function FrameSafeIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <path d="M4 8V5a1 1 0 0 1 1-1h3" strokeDasharray="0" />
      <path d="M12 4h3a1 1 0 0 1 1 1v3" />
      <path d="M16 12v3a1 1 0 0 1-1 1h-3" />
      <path d="M8 16H5a1 1 0 0 1-1-1v-3" />
      <rect x="8.5" y="8.5" width="3" height="3" rx="0.5" />
    </svg>
  )
}

export function PointerIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <path d="M5 3l14 8-6 1.5L10 19 5 3Z" />
    </svg>
  )
}

export function CircleAddIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <circle cx="10" cy="10" r="7" />
      <path d="M16 18h6" />
      <path d="M19 15v6" />
    </svg>
  )
}

export function RectAddIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <rect x="3" y="5" width="14" height="11" rx="1" />
      <path d="M16 18h6" />
      <path d="M19 15v6" />
    </svg>
  )
}

export function RuntimeConfigIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...iconProps(size)} {...props}>
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <rect x="10" y="10" width="4" height="4" />
      <path d="M9 2v3" />
      <path d="M15 2v3" />
      <path d="M9 19v3" />
      <path d="M15 19v3" />
      <path d="M2 9h3" />
      <path d="M2 15h3" />
      <path d="M19 9h3" />
      <path d="M19 15h3" />
    </svg>
  )
}
