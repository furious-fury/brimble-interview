import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonVariant = "default" | "danger";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  children: ReactNode;
  label: string;
}

const variantClasses: Record<IconButtonVariant, string> = {
  default: "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700",
  danger: "border-red-200 text-red-700 hover:bg-red-100",
};

/**
 * Icon-only button for compact actions.
 */
export function IconButton({
  variant = "default",
  children,
  label,
  className = "",
  disabled,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`
        flex h-9 w-9 items-center justify-center
        rounded-sm border
        transition
        disabled:cursor-not-allowed disabled:opacity-50
        ${variantClasses[variant]}
        ${className}
      `}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
