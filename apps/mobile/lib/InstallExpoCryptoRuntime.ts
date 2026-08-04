import * as ExpoCrypto from "expo-crypto"

function hasRequiredCryptoRuntime(value: unknown) {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const randomUuid = Reflect.get(value, "randomUUID")
  const subtle = Reflect.get(value, "subtle")
  return (
    typeof randomUuid === "function" &&
    typeof subtle === "object" &&
    subtle !== null &&
    typeof Reflect.get(subtle, "digest") === "function"
  )
}

function readDigestAlgorithmName(algorithm: AlgorithmIdentifier) {
  return typeof algorithm === "string" ? algorithm : algorithm.name
}

export function installExpoCryptoRuntime() {
  if (hasRequiredCryptoRuntime(globalThis.crypto)) {
    return
  }

  const expoCompatibleCryptoRuntime = Object.freeze({
    getRandomValues: ExpoCrypto.getRandomValues,
    randomUUID: ExpoCrypto.randomUUID,
    subtle: Object.freeze({
      digest: (algorithm: AlgorithmIdentifier, data: BufferSource) => {
        if (
          readDigestAlgorithmName(algorithm) !==
          ExpoCrypto.CryptoDigestAlgorithm.SHA256
        ) {
          throw new Error("The native runtime supports only SHA-256 digests")
        }

        return ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, data)
      },
    }),
  })

  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: expoCompatibleCryptoRuntime,
  })
}
