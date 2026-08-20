import { jest } from "@jest/globals"

jest.mock("react-native-worklets", () =>
  jest.requireActual("react-native-worklets/src/mock"),
)

const { setUpTests } = jest.requireActual<
  typeof import("react-native-reanimated")
>("react-native-reanimated")

jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<
      typeof import("react-native-safe-area-context/jest/mock")
    >("react-native-safe-area-context/jest/mock").default,
)

jest.mock("uniwind", () => ({
  withUniwind: <ComponentType>(Component: ComponentType) => Component,
}))

setUpTests()
