"use client"

import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"
import { cn } from "cn"

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return <RadioGroupPrimitive data-slot="radio-group" className={cn(className)} {...props} />
}

function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props) {
  // No dot indicator here on purpose — this app's toggle is a sliding pill
  // (a shared sibling `.toggle-indicator`, driven by the parent's
  // `toggle--yes`/`toggle--no` class), not a per-item radio dot. This item
  // is only styled via `.toggle-option` (App.css), passed in as className.
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn("toggle-option", className)}
      {...props}
    />
  )
}

export { RadioGroup, RadioGroupItem }
