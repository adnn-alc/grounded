import type { CSSProperties, ReactElement } from 'react'

const paths = {
  home:      <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/></>,
  cup:       <><path d="M5 8h12v6a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z"/><path d="M17 10h2a2 2 0 0 1 0 4h-2"/><path d="M8 3c0 1.5-1 1.5-1 3s1 1.5 1 3"/><path d="M12 3c0 1.5-1 1.5-1 3s1 1.5 1 3"/></>,
  timer:     <><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M9 3h6"/></>,
  history:   <><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 5v4h4"/><path d="M12 8v4l3 2"/></>,
  beans:     <><ellipse cx="12" cy="12" rx="6.5" ry="9.5" transform="rotate(35 12 12)"/><path d="M17 5.5c-3 1.5-2.5 4.5-5 6.5s-2 5-5 6.5"/></>,
  book:      <><path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M4 17a3 3 0 0 1 3-3h12"/></>,
  gear:      <><circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4"/></>,
  chart:     <><path d="M3 21V5"/><path d="M3 21h18"/><path d="M7 17v-4M11 17V9M15 17v-7M19 17V7"/></>,
  box:       <><path d="M3 7 12 3l9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/></>,
  plus:      <><path d="M12 5v14M5 12h14"/></>,
  minus:     <path d="M5 12h14"/>,
  search:    <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
  check:     <path d="M5 12l5 5L20 7"/>,
  arrow:     <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
  arrowUp:   <><path d="M12 19V5"/><path d="m6 11 6-6 6 6"/></>,
  arrowDown: <><path d="M12 5v14"/><path d="m6 13 6 6 6-6"/></>,
  dot:       <circle cx="12" cy="12" r="4" fill="currentColor"/>,
  more:      <><circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/></>,
  camera:    <><path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/></>,
  droplet:   <path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>,
  scale:     <><path d="M4 7h16l-2 13H6z"/><path d="M9 7V4h6v3"/><circle cx="12" cy="13" r="2"/></>,
  zap:       <path d="m13 2-9 12h7l-1 8 9-12h-7z"/>,
  flame:     <path d="M12 3s4 3 4 8-2 7-4 7-4-2-4-5 2-3 2-5-1-3 2-5z"/>,
  star:      <path d="M12 3l2.8 6 6.5.9-4.7 4.5 1.1 6.4L12 17.8 6.3 20.8l1.1-6.4L2.7 9.9l6.5-.9z"/>,
  bolt:      <path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="currentColor" stroke="none"/>,
  chevronR:  <path d="m9 6 6 6-6 6"/>,
  x:         <path d="M6 6l12 12M6 18L18 6"/>,
  mountain:  <path d="m3 20 6-10 4 6 3-4 5 8z"/>,
  sliders:   <><path d="M4 6h16M4 12h10M4 18h16"/><circle cx="16" cy="6" r="2" fill="var(--surface)"/><circle cx="18" cy="12" r="2" fill="var(--surface)"/><circle cx="8" cy="18" r="2" fill="var(--surface)"/></>,
  save:      <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></>,
  download:  <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
  trash:     <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></>,
  pencil:    <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>,
  dripper:   <><path d="M5 4h14l-3 8H8z"/><path d="M8 12v3a4 4 0 0 0 8 0v-3M12 19v2"/></>,
  machine:   <><rect x="4" y="3" width="16" height="12" rx="2"/><path d="M8 15v3h8v-3M6 21h12"/></>,
  archive:   <><path d="M3 4h18v4H3zM5 8v12h14V8M10 12h4"/></>,
  note:      <><path d="M5 3h10l4 4v14H5z"/><path d="M9 12h6M9 16h6"/></>,
  back:      <path d="m15 6-6 6 6 6"/>,
  chevronD:  <path d="m6 9 6 6 6-6"/>,
  snow:      <><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7"/><path d="m9.5 3.5 2.5 2 2.5-2M9.5 20.5l2.5-2 2.5 2M4 10.5l3-.5-1-3M20 13.5l-3 .5 1 3M4 13.5l3 .5-1 3M20 10.5l-3-.5 1-3"/></>,
  wrench:    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>,
} satisfies Record<string, ReactElement>

export type IconName = keyof typeof paths

interface IcoProps {
  name:       IconName
  size?:      number
  className?: string
  style?:     CSSProperties
}

export default function Ico({ name, size = 16, className = '', style = {} }: IcoProps) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
    >
      {paths[name] || paths.plus}
    </svg>
  )
}
