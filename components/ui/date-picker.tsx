"use client"

import * as React from "react"
import { format as formatDateFns, parse as parseDateFns } from "date-fns"
import { ptBR } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"

type DatePickerProps = {
  id?: string
  className?: string
  value?: string | undefined
  onChange: (yyyyMMdd: string | undefined) => void
  placeholder?: string
  disablePast?: boolean
}

export function DatePicker({ id, className, value, onChange, placeholder = "Escolher data", disablePast = false }: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const selectedDate: Date | undefined = React.useMemo(() => {
    if (!value) return undefined
    try {
      return parseDateFns(value, "yyyy-MM-dd", new Date())
    } catch {
      return undefined
    }
  }, [value])

  const display = React.useMemo(() => {
    return selectedDate ? formatDateFns(selectedDate, "dd/MM/yyyy", { locale: ptBR }) : undefined
  }, [selectedDate])

  const handleSelect = (d?: Date) => {
    const next = d ? formatDateFns(d, "yyyy-MM-dd") : undefined
    onChange(next)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={`w-full justify-start text-left font-normal ${className ?? ""}`}
        >
          {display ?? <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          locale={ptBR}
          fromYear={2020}
          toYear={2100}
          captionLayout="dropdown"
          ISOWeek
          initialFocus
          disabled={disablePast ? { before: new Date(new Date().toDateString()) } : undefined}
        />
      </PopoverContent>
    </Popover>
  )
}


