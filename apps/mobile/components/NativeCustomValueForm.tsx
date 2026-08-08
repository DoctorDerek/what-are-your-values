import { CUSTOM_VALUE_STARTER_EXAMPLES } from "@game/data/src/CustomValueStarterExamples"
import {
  CUSTOM_VALUE_DEFINITION_MAX_GRAPHEMES,
  CUSTOM_VALUE_NAME_MAX_GRAPHEMES,
  validateCustomValueDraft,
} from "@game/data/src/CustomValueValidation"
import {
  getValueDisplayName,
  type CustomValueDefinition,
  type CustomValueId,
  type ValueId,
} from "@game/data/src/Value"
import type { RankedValue } from "@game/data/src/ValueRanking"
import { findRankedValueNameMatches } from "@game/data/src/ValueSearch"
import { useMemo, useRef, useState } from "react"
import { TextInput, View } from "react-native"
import NativeCustomValueFieldFeedback from "@/components/NativeCustomValueFieldFeedback"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"

export default function NativeCustomValueForm({
  existingCustomValues,
  excludedCustomValueId = null,
  initialDefinition = "",
  initialName = "",
  isPersistencePending,
  mode,
  onCancel,
  onOpenMatchingValue,
  onSubmit,
  rankedValues,
}: {
  readonly existingCustomValues: readonly CustomValueDefinition[]
  readonly excludedCustomValueId?: CustomValueId | null
  readonly initialDefinition?: string
  readonly initialName?: string
  readonly isPersistencePending: boolean
  readonly mode: "add" | "edit"
  readonly onCancel: () => void
  readonly onOpenMatchingValue: (valueId: ValueId) => void
  readonly onSubmit: (name: string, definition: string) => void
  readonly rankedValues: readonly RankedValue[]
}) {
  const definitionInputRef = useRef<TextInput>(null)
  const [name, setName] = useState(initialName)
  const [definition, setDefinition] = useState(initialDefinition)
  const [isNameTouched, setIsNameTouched] = useState(false)
  const [isDefinitionTouched, setIsDefinitionTouched] = useState(false)
  const [isConfirmingEdit, setIsConfirmingEdit] = useState(false)
  const validation = useMemo(
    () =>
      validateCustomValueDraft({
        name,
        definition,
        existingCustomValues,
        excludedCustomValueId,
      }),
    [definition, excludedCustomValueId, existingCustomValues, name],
  )
  const matchingValues = useMemo(
    () =>
      findRankedValueNameMatches(rankedValues, validation.name.value).filter(
        ({ definition: matchingDefinition }) =>
          matchingDefinition.id !== excludedCustomValueId,
      ),
    [excludedCustomValueId, rankedValues, validation.name.value],
  )
  const hasChanged =
    validation.name.value !== initialName ||
    validation.definition.value !== initialDefinition
  const canSubmit =
    validation.isValid &&
    !isPersistencePending &&
    (mode === "add" || hasChanged)

  const submitDraft = () => {
    if (!canSubmit) {
      setIsNameTouched(true)
      setIsDefinitionTouched(true)
      return
    }

    if (mode === "edit" && !isConfirmingEdit) {
      setIsConfirmingEdit(true)
      return
    }

    onSubmit(validation.name.value, validation.definition.value)
  }

  return (
    <View
      accessibilityLabel={
        mode === "add" ? "Add Custom Value" : `Edit ${initialName}`
      }
      className="gap-4 border-4 border-black bg-white p-4 shadow-[6px_6px_0px_0px_#000000]"
    >
      {mode === "add" ? (
        <>
          <Text
            accessibilityRole="header"
            className="text-2xl font-black text-black uppercase"
          >
            Custom Value Builder
          </Text>
          <Text className="text-base leading-6 font-bold text-black">
            Start with an example or add your own. Each example fills an unsaved
            draft that you can edit before saving.
          </Text>
          <Text className="text-lg font-black text-black uppercase">
            Examples—not recommendations
          </Text>
          <View className="gap-3">
            {CUSTOM_VALUE_STARTER_EXAMPLES.map(
              ({ definition: exampleDefinition, label, name: exampleName }) => (
                <Button
                  key={exampleName}
                  accessibilityHint={label ?? undefined}
                  disabled={isPersistencePending}
                  variant="secondary"
                  onPress={() => {
                    setName(exampleName)
                    setDefinition(exampleDefinition)
                    setIsNameTouched(false)
                    setIsDefinitionTouched(false)
                    setIsConfirmingEdit(false)
                    definitionInputRef.current?.focus()
                  }}
                >
                  <View className="items-center">
                    <Text>+ Start with {exampleName}</Text>
                    {label ? (
                      <Text className="mt-1 text-xs font-bold text-black normal-case">
                        {label}
                      </Text>
                    ) : null}
                  </View>
                </Button>
              ),
            )}
          </View>
        </>
      ) : null}

      <Text className="text-lg font-black text-black uppercase">
        Value Name
      </Text>
      <TextInput
        accessibilityLabel="Value Name"
        aria-invalid={isNameTouched && validation.name.validationCode !== null}
        autoCapitalize="words"
        className="min-h-14 border-4 border-black bg-white p-3 text-xl font-bold text-black"
        editable={!isPersistencePending}
        onBlur={() => setIsNameTouched(true)}
        onChangeText={(value) => {
          setName(value)
          setIsConfirmingEdit(false)
        }}
        onSubmitEditing={() => definitionInputRef.current?.focus()}
        placeholder="Value name"
        returnKeyType="next"
        value={name}
      />
      <NativeCustomValueFieldFeedback
        field="name"
        maximumGraphemeCount={CUSTOM_VALUE_NAME_MAX_GRAPHEMES}
        showValidationMessage={
          isNameTouched || validation.name.validationCode === "duplicate_name"
        }
        validation={validation.name}
      />

      <Text className="text-lg font-black text-black uppercase">
        What This Value Means to Me
      </Text>
      <TextInput
        ref={definitionInputRef}
        accessibilityLabel="What This Value Means to Me"
        aria-invalid={
          isDefinitionTouched && validation.definition.validationCode !== null
        }
        className="min-h-32 border-4 border-black bg-white p-3 text-xl font-bold text-black"
        editable={!isPersistencePending}
        multiline
        onBlur={() => setIsDefinitionTouched(true)}
        onChangeText={(value) => {
          setDefinition(value)
          setIsConfirmingEdit(false)
        }}
        placeholder="Write your personal definition"
        textAlignVertical="top"
        value={definition}
      />
      <NativeCustomValueFieldFeedback
        field="definition"
        maximumGraphemeCount={CUSTOM_VALUE_DEFINITION_MAX_GRAPHEMES}
        showValidationMessage={isDefinitionTouched}
        validation={validation.definition}
      />

      {matchingValues.length > 0 ? (
        <View className="bg-mapache-vivid-primary-cyan/20 gap-3 border-4 border-black p-4">
          <Text className="text-lg font-black text-black uppercase">
            {validation.name.validationCode === "duplicate_name"
              ? "Matching value"
              : "Matching values"}
          </Text>
          {matchingValues.map(({ definition: matchingDefinition }) => (
            <Button
              key={matchingDefinition.id}
              disabled={isPersistencePending}
              variant="outline"
              onPress={() => onOpenMatchingValue(matchingDefinition.id)}
            >
              <Text>Open {getValueDisplayName(matchingDefinition)}</Text>
            </Button>
          ))}
        </View>
      ) : null}

      {isConfirmingEdit ? (
        <View
          accessibilityRole="alert"
          className="bg-mapache-vivid-primary-orange gap-4 border-4 border-black p-4"
        >
          <Text className="text-base leading-6 font-black text-black">
            Earlier comparisons remain part of your progress history. Updating
            this Custom Value keeps its progress, starts one revised cycle, and
            clears Undo and Redo.
          </Text>
          <View className="flex-row gap-3">
            <Button
              className="min-w-0 flex-1"
              disabled={isPersistencePending}
              variant="secondary"
              onPress={() => setIsConfirmingEdit(false)}
            >
              <Text>Cancel</Text>
            </Button>
            <Button
              className="min-w-0 flex-1"
              disabled={!canSubmit}
              onPress={submitDraft}
            >
              <Text>{isPersistencePending ? "Saving…" : "Update Value"}</Text>
            </Button>
          </View>
        </View>
      ) : (
        <View className="flex-row gap-3">
          <Button
            className="min-w-0 flex-1"
            disabled={!canSubmit}
            onPress={submitDraft}
          >
            <Text>
              {isPersistencePending
                ? "Saving…"
                : mode === "edit"
                  ? "Review Update"
                  : "Save Value"}
            </Text>
          </Button>
          <Button
            className="min-w-0 flex-1"
            disabled={isPersistencePending}
            variant="destructive"
            onPress={onCancel}
          >
            <Text>Cancel</Text>
          </Button>
        </View>
      )}
    </View>
  )
}
