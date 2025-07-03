import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { cn } from "../utils"

export type TooltipProps = {
    content: React.ReactNode
    children: React.ReactNode
    delayDuration?: number
    side?: "top" | "right" | "bottom" | "left"
    align?: "start" | "center" | "end"
}

export function Tooltip({ content, children, delayDuration = 300, side = "top", align = "center" }: TooltipProps) {
    return (
        <TooltipPrimitive.Provider>
            <TooltipPrimitive.Root delayDuration={delayDuration}>
                <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content
                        side={side}
                        align={align}
                        sideOffset={4}
                        className={cn(
                            "z-10 overflow-hidden rounded-xl px-4 py-2 text-sm",
                            "bg-black text-white shadow-lg",
                            "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
                            "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
                            "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
                        )}
                    >
                        {content}
                        <TooltipPrimitive.Arrow className="fill-black" />
                    </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>
        </TooltipPrimitive.Provider>
    )
}
