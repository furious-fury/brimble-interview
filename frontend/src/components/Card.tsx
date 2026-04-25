import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Simple card component with optional title.
 */
export function Card({ title, children, className = "" }: CardProps) {
  return (
    <div className={`rounded-sm border border-slate-200 bg-slate-50 p-4 ${className}`}>
      {title && (
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
          {title}
        </p>
      )}
      <div className={title ? "mt-1" : ""}>{children}</div>
    </div>
  );
}
