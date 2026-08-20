import type { ImgHTMLAttributes, SVGProps } from "react";

const SvgPropsDefault: SVGProps<SVGSVGElement> = {
  fill: "none",
  strokeLinejoin: "round",
  strokeLinecap: "round",
  viewBox: "0 0 24 24",
};

export function DockerIcon({ src, alt, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      src={src || "/docker_logo.svg"}
      alt={alt || "Docker"}
      draggable={false}
      {...props}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
        if (props.onError) props.onError(e);
      }}
    />
  );
}

export function GpuHostIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...SvgPropsDefault} {...props} viewBox="0 0 64 64">
      <defs>
        <linearGradient id="hostCard" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
      <rect x="6" y="16" width="52" height="32" rx="4" fill="#0F172A" stroke="#334155" strokeWidth="2" />
      <rect x="9" y="19" width="26" height="14" rx="2" fill="url(#hostCard)" />
      <rect x="37" y="19" width="18" height="6" rx="1.2" fill="#1E293B" stroke="#475569" />
      <rect x="37" y="27" width="18" height="6" rx="1.2" fill="#1E293B" stroke="#475569" />
      <g fill="#94A3B8">
        <rect x="9" y="37" width="6" height="7" rx="1" />
        <rect x="17" y="37" width="6" height="7" rx="1" />
        <rect x="25" y="37" width="6" height="7" rx="1" />
        <rect x="33" y="37" width="6" height="7" rx="1" />
        <rect x="41" y="37" width="6" height="7" rx="1" />
        <rect x="49" y="37" width="6" height="7" rx="1" />
      </g>
      <circle cx="17" cy="26" r="1.8" fill="#86EFAC" />
      <circle cx="21.5" cy="26" r="1.8" fill="#FDE047" />
      <circle cx="26" cy="26" r="1.8" fill="#FCA5A5" />
      <rect x="14" y="50" width="36" height="3" rx="1.2" fill="#475569" />
      <rect x="2" y="12" width="4" height="40" rx="1.5" fill="#334155" />
      <rect x="58" y="12" width="4" height="40" rx="1.5" fill="#334155" />
    </svg>
  );
}

export function SettingsGearIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...SvgPropsDefault} {...props} viewBox="0 0 24 24">
      <g fill="currentColor">
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
        <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </g>
    </svg>
  );
}

export function CpuChipIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...SvgPropsDefault} {...props} viewBox="0 0 24 24">
      <rect x="5" y="5" width="14" height="14" rx="2" fill="#0F172A" stroke="currentColor" strokeWidth="1.5" />
      <rect x="8" y="8" width="8" height="8" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M9 2V5" />
        <path d="M15 2V5" />
        <path d="M9 19V22" />
        <path d="M15 19V22" />
        <path d="M2 9H5" />
        <path d="M2 15H5" />
        <path d="M19 9h3" />
        <path d="M19 15h3" />
      </g>
    </svg>
  );
}

export function GpuCardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...SvgPropsDefault} {...props} viewBox="0 0 24 24">
      <rect x="2" y="6" width="20" height="13" rx="2" fill="#0B1220" stroke="currentColor" strokeWidth="1.4" />
      <rect x="5" y="9" width="9" height="7" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="9.5" cy="12.5" r="1.3" fill="currentColor" />
      <g fill="currentColor">
        <rect x="15.5" y="9" width="5" height="2" rx="0.6" />
        <rect x="15.5" y="11.8" width="5" height="2" rx="0.6" />
        <rect x="15.5" y="14.6" width="5" height="1.4" rx="0.6" />
      </g>
      <rect x="4" y="19" width="16" height="1.5" rx="0.6" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

export default {};
