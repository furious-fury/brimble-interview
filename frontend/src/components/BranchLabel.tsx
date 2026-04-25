import { GitBranch, Loader2 } from "lucide-react";

interface BranchLabelProps {
  isLoading: boolean;
  inputId: string;
}

/**
 * Label for branch input with loading indicator.
 */
export function BranchLabel({ isLoading, inputId }: BranchLabelProps) {
  return (
    <label
      className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-500"
      htmlFor={inputId}
    >
      <GitBranch className="h-3.5 w-3.5" />
      Branch
      {isLoading && (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
      )}
    </label>
  );
}
