type BackButtonProps = {
  href: string;
  className?: string;
};

export function BackButton({ href, className = "btn btn-secondary" }: BackButtonProps) {
  return (
    <a href={href} className={className}>
      返回上一页
    </a>
  );
}
