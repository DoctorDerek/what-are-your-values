import { jest } from "@jest/globals"
import { setUpTests } from "react-native-reanimated"

jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("react-native-safe-area-context/jest/mock"),
)

jest.mock("uniwind", () => ({
  withUniwind: <ComponentType>(Component: ComponentType) => Component,
}))

setUpTests()
