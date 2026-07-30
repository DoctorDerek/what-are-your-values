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
import { StyleSheet, Text, TextInput, View } from "react-native"
import MapacheButton from "@/components/MapacheButton"
import NativeCustomValueFieldFeedback from "@/components/NativeCustomValueFieldFeedback"
import {
  mapacheColors,
  mapacheLayout,
  mapacheSpacing,
} from "@/theme/MapacheVividTheme"

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
    <View style={styles.form}>
      {mode === "add" ? (
        <>
          <Text accessibilityRole="header" style={styles.formHeading}>
            Custom Value Builder
          </Text>
          <Text style={styles.description}>
            Start with an example or add your own. Each example fills an unsaved
            draft that you can edit before saving.
          </Text>
          <Text style={styles.exampleHeading}>
            Examples—not recommendations
          </Text>
          <View style={styles.actions}>
            {CUSTOM_VALUE_STARTER_EXAMPLES.map(
              ({ definition: exampleDefinition, label, name: exampleName }) => (
                <MapacheButton
                  key={exampleName}
                  accessibilityHint={label ?? undefined}
                  disabled={isPersistencePending}
                  label={`+ Start with ${exampleName}`}
                  onPress={() => {
                    setName(exampleName)
                    setDefinition(exampleDefinition)
                    setIsNameTouched(false)
                    setIsDefinitionTouched(false)
                    setIsConfirmingEdit(false)
                  }}
                  tone="cyan"
                />
              ),
            )}
          </View>
        </>
      ) : null}

      <Text style={styles.label}>Custom Value Name</Text>
      <TextInput
        accessibilityLabel="Custom Value Name"
        autoCapitalize="words"
        editable={!isPersistencePending}
        onBlur={() => setIsNameTouched(true)}
        onChangeText={(value) => {
          setName(value)
          setIsConfirmingEdit(false)
        }}
        onSubmitEditing={() => definitionInputRef.current?.focus()}
        placeholder="Value name"
        placeholderTextColor={mapacheColors.charcoal}
        returnKeyType="next"
        selectionColor={mapacheColors.cyan}
        style={styles.input}
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

      <Text style={styles.label}>Personal Definition</Text>
      <TextInput
        ref={definitionInputRef}
        accessibilityLabel="Personal Definition"
        editable={!isPersistencePending}
        multiline
        onBlur={() => setIsDefinitionTouched(true)}
        onChangeText={(value) => {
          setDefinition(value)
          setIsConfirmingEdit(false)
        }}
        placeholder="What does this value mean to you?"
        placeholderTextColor={mapacheColors.charcoal}
        selectionColor={mapacheColors.cyan}
        style={[styles.input, styles.definitionInput]}
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
        <View style={styles.matches}>
          <Text style={styles.matchHeading}>
            {validation.name.validationCode === "duplicate_name"
              ? "Matching value"
              : "Matching values"}
          </Text>
          {matchingValues.map(({ definition: matchingDefinition }) => (
            <MapacheButton
              key={matchingDefinition.id}
              disabled={isPersistencePending}
              label={`Open ${getValueDisplayName(matchingDefinition)}`}
              onPress={() => onOpenMatchingValue(matchingDefinition.id)}
              tone="cyan"
            />
          ))}
        </View>
      ) : null}

      {isConfirmingEdit ? (
        <View accessibilityRole="alert" style={styles.confirmation}>
          <Text style={styles.confirmationText}>
            Earlier comparisons remain part of your progress history. Updating
            this Custom Value starts one revised cycle and clears Undo and Redo.
          </Text>
          <View style={styles.actions}>
            <MapacheButton
              disabled={isPersistencePending}
              label="Cancel"
              onPress={() => setIsConfirmingEdit(false)}
              tone="purple"
            />
            <MapacheButton
              disabled={!canSubmit}
              label={isPersistencePending ? "Saving…" : "Update Value"}
              onPress={submitDraft}
            />
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <MapacheButton
            disabled={!canSubmit}
            label={
              isPersistencePending
                ? "Saving…"
                : mode === "edit"
                  ? "Review Update"
                  : "Save Value"
            }
            onPress={submitDraft}
            tone="green"
          />
          <MapacheButton
            disabled={isPersistencePending}
            label="Cancel"
            onPress={onCancel}
            tone="red"
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  actions: {
    gap: mapacheSpacing.standard,
  },
  confirmation: {
    backgroundColor: mapacheColors.orange,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    gap: mapacheSpacing.standard,
    padding: mapacheSpacing.standard,
  },
  confirmationText: {
    color: mapacheColors.white,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 26,
  },
  definitionInput: {
    minHeight: 128,
  },
  description: {
    color: mapacheColors.charcoal,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 25,
  },
  exampleHeading: {
    color: mapacheColors.charcoal,
    fontSize: 18,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  form: {
    backgroundColor: mapacheColors.white,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    gap: mapacheSpacing.standard,
    padding: mapacheSpacing.standard,
  },
  formHeading: {
    color: mapacheColors.charcoal,
    fontSize: 26,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: mapacheColors.white,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    color: mapacheColors.charcoal,
    fontSize: 20,
    fontWeight: "700",
    padding: mapacheSpacing.standard,
  },
  label: {
    color: mapacheColors.charcoal,
    fontSize: 18,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  matches: {
    backgroundColor: mapacheColors.white,
    borderColor: mapacheColors.cyan,
    borderWidth: mapacheLayout.borderWidth,
    gap: mapacheSpacing.compact,
    padding: mapacheSpacing.standard,
  },
  matchHeading: {
    color: mapacheColors.charcoal,
    fontSize: 18,
    fontWeight: "900",
    textTransform: "uppercase",
  },
})
