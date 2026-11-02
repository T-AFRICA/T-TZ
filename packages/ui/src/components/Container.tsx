import type { HTMLAttributes, ReactNode } from "react";

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** Page-width wrapper: full width (--container-max) with a 16px gutter, widening on large screens. */
export function Container({ className, children, ...rest }: ContainerProps) {
  const classes = ["mx-auto w-full max-w-[var(--container-max)] px-[var(--gutter)] lg:px-8", className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
