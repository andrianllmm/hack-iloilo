import { Info, type LucideIcon, TriangleAlert } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "cn";

function HintIcon({
  icon: Icon,
  text,
  className,
}: {
  icon: LucideIcon;
  text: string;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span tabIndex={0} />}
        aria-label={text}
        className={cn("inline-flex", className)}
      >
        <Icon className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

/** Marks a figure IRPC has not confirmed yet (see PRD open questions). */
export function UnconfirmedIcon() {
  return (
    <HintIcon
      icon={TriangleAlert}
      text="Unconfirmed by IRPC"
      className="text-warning"
    />
  );
}

/** Explains a field on hover or focus. */
export function InfoIcon({ text }: { text: string }) {
  return <HintIcon icon={Info} text={text} className="text-muted-foreground" />;
}
