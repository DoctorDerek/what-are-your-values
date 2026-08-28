import { describe, expect, it, jest } from "@jest/globals"
import { render, screen, userEvent } from "@testing-library/react-native"
import { Pressable, Text as ReactNativeText } from "react-native"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"

describe("native UI primitives", () => {
  it("composes button behavior and styling onto a native child", async () => {
    const onPress = jest.fn()
    const user = userEvent.setup()
    await render(
      <Button asChild size="compact" variant="secondary" onPress={onPress}>
        <Pressable>
          <Text>Browse Values</Text>
        </Pressable>
      </Button>,
    )

    const button = screen.getByRole("button", { name: "Browse Values" })
    expect(button).toHaveProp(
      "className",
      expect.stringContaining("bg-mapache-vivid-primary-cyan"),
    )
    expect(button).toHaveProp("className", expect.stringContaining("min-h-12"))

    await user.press(button)

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it("composes heading semantics onto a native text child", async () => {
    await render(
      <Text asChild variant="h2">
        <ReactNativeText>Section Title</ReactNativeText>
      </Text>,
    )

    expect(screen.getByRole("heading", { name: "Section Title" })).toHaveProp(
      "aria-level",
      "2",
    )
  })

  it("keeps explicitly unstyled text free of invented heading metadata", async () => {
    await render(<Text variant={null}>Plain copy</Text>)

    const plainCopy = screen.getByText("Plain copy")
    expect(plainCopy.props.role).toBeUndefined()
    expect(plainCopy.props["aria-level"]).toBeUndefined()
  })
})
