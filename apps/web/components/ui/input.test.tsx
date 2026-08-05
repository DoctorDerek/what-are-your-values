import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Input } from "@/components/ui/input"

describe("Input Primitive Integration", () => {
  it("preserves native input behavior inside the Vivid field contract", () => {
    render(
      <label>
        Value Name
        <Input type="text" defaultValue="Ingenuity" />
      </label>,
    )

    const input = screen.getByRole("textbox", { name: "Value Name" })
    expect(input).toHaveAttribute("data-slot", "input")
    expect(input).toHaveClass("min-h-11", "border-4", "bg-card")

    fireEvent.change(input, { target: { value: "Creativity" } })
    expect(input).toHaveValue("Creativity")
  })

  it("exposes invalid and disabled states to the browser", () => {
    render(<Input aria-label="Invalid value" aria-invalid disabled />)

    const input = screen.getByRole("textbox", { name: "Invalid value" })
    expect(input).toBeDisabled()
    expect(input).toHaveAttribute("aria-invalid", "true")
  })
})
