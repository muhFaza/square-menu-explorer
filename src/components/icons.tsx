import type { SVGProps } from "react";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  readonly size?: number;
}

function Icon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    />
  );
}

export function CupIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 8h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8Z" />
      <path d="M16 9h2a2.5 2.5 0 0 1 0 5h-2" />
      <path d="M8 2.5c-.6.8-.6 1.7 0 2.5M12 2.5c-.6.8-.6 1.7 0 2.5" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Icon>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21c4.5-4.2 7-7.5 7-11a7 7 0 1 0-14 0c0 3.5 2.5 6.8 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Icon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 12 4.5 4.5L19 7" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Icon>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h11M4 17h7" />
      <circle cx="18" cy="7" r="2.2" />
      <circle cx="14" cy="17" r="2.2" />
    </Icon>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 11 12 4l8 7" />
      <path d="M6 10v9h12v-9" />
    </Icon>
  );
}

export function LeafIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20c0-8 6-14 16-14 0 10-6 15-14 15a5 5 0 0 1-2-1Z" />
      <path d="M9 15c2.5-2.5 5-4 8-5" />
    </Icon>
  );
}

export function CroissantIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 16c4 2 14 2 18 0-1-2-3-3.5-5-4M3 16c-.5-4 .5-6 2-7 1.5 2 3 3.5 5 4M3 16l3-1M21 16l-3-1" />
      <path d="M10 13c1.5 1 3 1 5 0" />
    </Icon>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </Icon>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5Z" />
    </Icon>
  );
}

export function SandwichIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 8c0-1.5 4-3 9-3s9 1.5 9 3-4 3-9 3-9-1.5-9-3Z" />
      <path d="M4 12c1.5 1 4 1.5 8 1.5s6.5-.5 8-1.5" />
      <path d="M4 15.5c1.5 1.2 4 1.8 8 1.8s6.5-.6 8-1.8V9M4 9v6.5" />
    </Icon>
  );
}

export function SaladIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12h16a8 8 0 0 1-16 0Z" />
      <path d="M6 12c-1-2-.5-3.5.5-4.5M12 12c-2-1.5-2-4 0-6 1.5 2 1.5 4 0 6M17 12c1.5-1 2.5-1 3.5-.5" />
      <path d="M8 20h8" />
    </Icon>
  );
}

export function BowlIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 11h18a9 9 0 0 1-18 0Z" />
      <path d="M8 11c0-2 1.5-3 4-3s4 1 4 3" />
      <path d="M12 5v3" />
    </Icon>
  );
}

export function CakeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20h16v-7a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v7Z" />
      <path d="M4 15c1.5 1.5 3 1.5 4 0s2.5-1.5 4 0 2.5 1.5 4 0 2.5-1.5 4 0" />
      <path d="M12 6V4M12 6c-.8-.6-.8-1.4 0-2" />
    </Icon>
  );
}

export function GlassIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 4h12l-1.5 15h-9L6 4Z" />
      <path d="M6.7 9h10.6" />
      <path d="M12 4v15" />
    </Icon>
  );
}

export function PlateIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
    </Icon>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 20s-7-4.3-7-9.5A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.5C19 15.7 12 20 12 20Z" />
    </Icon>
  );
}

export function HeartSolidIcon(props: IconProps) {
  const solidProps: IconProps = { fill: "currentColor", stroke: "none", ...props };
  return (
    <Icon {...solidProps}>
      <path d="M12 20s-7-4.3-7-9.5A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.5C19 15.7 12 20 12 20Z" />
    </Icon>
  );
}

export function ReceiptIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 3h12v18l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3L6 21V3Z" />
      <path d="M9 8h6M9 12h6" />
    </Icon>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </Icon>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6 18 18M18 6 6 18" />
    </Icon>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  );
}

export function MenuGridIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect height="7" rx="1.5" width="7" x="4" y="4" />
      <rect height="7" rx="1.5" width="7" x="13" y="4" />
      <rect height="7" rx="1.5" width="7" x="4" y="13" />
      <rect height="7" rx="1.5" width="7" x="13" y="13" />
    </Icon>
  );
}
