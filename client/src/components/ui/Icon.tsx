import type { SVGProps } from 'react';

// A small hand-picked icon set (16px grid, 1.5px stroke) so the app has no icon-font dependency.
const PATHS = {
  plus: 'M8 3.5v9M3.5 8h9',
  chevronLeft: 'M10 3.5 5.5 8l4.5 4.5',
  chevronRight: 'M6 3.5 10.5 8 6 12.5',
  chevronDown: 'M3.5 6 8 10.5 12.5 6',
  arrowUpRight: 'M5.5 10.5 10.5 5.5M6 5.5h4.5V10',
  check: 'M3.5 8.5 6.5 11.5 12.5 4.5',
  close: 'M4 4l8 8M12 4l-8 8',
  alert: 'M8 5.5v3.25M8 11v.01M7.13 2.5 1.8 11.75a1 1 0 0 0 .87 1.5h10.66a1 1 0 0 0 .87-1.5L8.87 2.5a1 1 0 0 0-1.74 0Z',
  info: 'M8 7.25v4M8 5v.01M14.5 8a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z',
  refresh: 'M13 8a5 5 0 1 1-1.46-3.54M13 3v2.5h-2.5',
  inbox: 'M1.75 8.5h3.5l1 2h3.5l1-2h3.5M3.2 3.25h9.6l1.45 5.25v3.75a.5.5 0 0 1-.5.5H2.25a.5.5 0 0 1-.5-.5V8.5L3.2 3.25Z',
  file: 'M9 1.75H4.25a.5.5 0 0 0-.5.5v11.5a.5.5 0 0 0 .5.5h7.5a.5.5 0 0 0 .5-.5V5M9 1.75 12.25 5M9 1.75V5h3.25M5.75 8.25h4.5M5.75 10.75h3',
  log: 'M2.5 3.5h11M2.5 8h11M2.5 12.5h7',
  users: 'M6 7.25a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.5 13.5c.4-2.3 2.2-3.75 4.5-3.75s4.1 1.45 4.5 3.75M10.75 2.4a2.5 2.5 0 0 1 0 4.7M12.25 9.9c1.2.5 2 1.55 2.25 3.1',
  sun: 'M8 10.75a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5ZM8 1.25v1.5M8 13.25v1.5M14.75 8h-1.5M2.75 8h-1.5M12.77 3.23l-1.06 1.06M4.29 11.71l-1.06 1.06M12.77 12.77l-1.06-1.06M4.29 4.29 3.23 3.23',
  moon: 'M13.5 9.6A5.75 5.75 0 0 1 6.4 2.5a5.75 5.75 0 1 0 7.1 7.1Z',
  monitor: 'M2 3h12v8H2zM6 14h4M8 11v3',
  logout: 'M6 2.75H3.25a.5.5 0 0 0-.5.5v9.5a.5.5 0 0 0 .5.5H6M10.5 11l3-3-3-3M13.5 8H6',
  book: 'M2.25 3.25c1.9-.6 3.9-.4 5.75.75 1.85-1.15 3.85-1.35 5.75-.75v9.5c-1.9-.6-3.9-.4-5.75.75-1.85-1.15-3.85-1.35-5.75-.75v-9.5ZM8 4v9.5',
  copy: 'M5.5 5.5V3a.75.75 0 0 1 .75-.75H13a.75.75 0 0 1 .75.75v6.75a.75.75 0 0 1-.75.75h-2.5M3 5.5h6.75a.75.75 0 0 1 .75.75V13a.75.75 0 0 1-.75.75H3a.75.75 0 0 1-.75-.75V6.25A.75.75 0 0 1 3 5.5Z',
  menu: 'M2.5 4h11M2.5 8h11M2.5 12h11',
  pencil: 'M10.5 2.75 13.25 5.5M2.5 13.5l.6-3.1 7.8-7.8a1 1 0 0 1 1.4 0l1.4 1.4a1 1 0 0 1 0 1.4l-7.8 7.8-3.4.3Z',
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
