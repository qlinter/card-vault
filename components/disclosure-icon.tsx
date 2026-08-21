type DisclosureIconProps = {
  expanded: boolean;
  className?: string;
};

export function DisclosureIcon({ expanded, className = "" }: DisclosureIconProps) {
  return (
    <span
      className={`disclosure-icon${expanded ? " is-expanded" : ""}${className ? ` ${className}` : ""}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 16 16" focusable="false">
        <path d="m3 6 5 5 5-5" />
      </svg>
    </span>
  );
}
