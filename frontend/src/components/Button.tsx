import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-slate-800 text-blue-50 hover:bg-slate-900 border-transparent",
  secondary: "bg-white text-slate-700 border-slate-200 hover:border-slate-300",
  danger: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100",
  ghost: "bg-transparent text-slate-500 border-transparent hover:text-slate-700",
};

/**
 * Button component with consistent styling and variants.
 */
export function Button({
  variant = "primary",
  isLoading = false,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center gap-1.5
        rounded-sm border px-4 py-2
        text-sm font-medium
        transition
        disabled:cursor-not-allowed disabled:opacity-50
        ${variantClasses[variant]}
        ${className}
      `}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
