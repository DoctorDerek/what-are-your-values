import { CANONICAL_VALUES } from "@game/data/src/CanonicalValues"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ValueChoiceCard } from "@/components/ValueChoiceCard"

describe("animal card attention", () => {
  it("combines pointer and actual focus without selecting or repeating attention", () => {
    const value = CANONICAL_VALUES[0]
    const onActivate = vi.fn()
    const props = {
      position: "first" as const,
      value,
      level: 1,
      focusedId: null,
      winnerId: null,
      isEnabled: true,
      isAnimating: false,
      controlHint: null,
      onActivate,
      onFocus: vi.fn(),
      combatant: (isAttended: boolean) => (
        <span>{isAttended ? "Animal alert" : "Animal resting"}</span>
      ),
    }
    const { rerender } = render(<ValueChoiceCard {...props} />)
    const choice = screen.getByRole("button", { name: /^Choose / })
    expect(screen.getByText("Animal resting")).toBeVisible()
    fireEvent.pointerEnter(choice, { pointerType: "mouse" })
    expect(screen.getByText("Animal alert")).toBeVisible()
    fireEvent.focus(choice)
    fireEvent.pointerLeave(choice)
    expect(screen.getByText("Animal alert")).toBeVisible()
    expect(onActivate).not.toHaveBeenCalled()
    fireEvent.blur(choice)
    expect(screen.getByText("Animal resting")).toBeVisible()
    fireEvent.pointerEnter(choice, { pointerType: "touch" })
    expect(screen.getByText("Animal resting")).toBeVisible()
    fireEvent.click(choice)
    expect(onActivate).toHaveBeenCalledExactlyOnceWith(value.id)
    rerender(<ValueChoiceCard {...props} isEnabled={false} />)
    fireEvent.focus(choice)
    expect(screen.getByText("Animal resting")).toBeVisible()
  })
})
