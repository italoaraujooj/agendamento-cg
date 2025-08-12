"use client"

import { Toaster as Sonner } from "sonner"

export function Toaster() {
  return (
    <Sonner
      richColors
      closeButton
      theme="system"
      position="top-right"
      expand
    />
  )
}


