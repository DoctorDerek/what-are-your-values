import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Textarea } from "@/components/ui/textarea"

describe("Textarea Primitive Integration", () => {
  it("preserves multiline editing inside the Vivid field contract", () => {
    render(<Textarea aria-label="Definition" defaultValue="Original meaning" />)

    const textarea = screen.getByRole("textbox", { name: "Definition" })
    expect(textarea).toHaveAttribute("data-slot", "textarea")
    expect(textarea).toHaveClass("min-h-24", "border-4", "bg-card")

    fireEvent.change(textarea, { target: { value: "Personal meaning" } })
    expect(textarea).toHaveValue("Personal meaning")
  })

  it("preserves the caller’s size and disabled state", () => {
    render(<Textarea aria-label="Locked definition" rows={7} disabled />)

    const textarea = screen.getByRole("textbox", {
      name: "Locked definition",
    })
    expect(textarea).toHaveAttribute("rows", "7")
    expect(textarea).toBeDisabled()
  })
})
