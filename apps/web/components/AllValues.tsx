"use client"

import { CUSTOM_VALUE_STARTER_EXAMPLES } from "@game/data/src/CustomValueStarterExamples"
import {
  CUSTOM_VALUE_DEFINITION_MAX_GRAPHEMES,
  CUSTOM_VALUE_NAME_MAX_GRAPHEMES,
  validateCustomValueDraft,
} from "@game/data/src/CustomValueValidation"
import {
  getValueDisplayDefinition,
  getValueDisplayName,
  type CustomValueId,
  type ValueId,
} from "@game/data/src/Value"
import {
  sortRankedValuesAlphabetically,
  type RankedValue,
} from "@game/data/src/ValueRanking"
import {
  filterRankedValuesByQuery,
  findRankedValueNameMatches,
} from "@game/data/src/ValueSearch"
import type { FormEvent } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import CustomValueFieldFeedback from "@/components/CustomValueFieldFeedback"
import ValueLevelProgress from "@/components/ValueLevelProgress"

export default function AllValues({
  rankedValues,
  initialValueId,
  openCustomValueBuilder,
  isPersistencePending = false,
  persistenceIssue = null,
  onClose,
  onAddCustomValue,
  onUpdateCustomValue,
  onDeleteCustomValue,
}: {
  rankedValues: readonly RankedValue[]
  initialValueId?: ValueId | null
  openCustomValueBuilder?: boolean
  isPersistencePending?: boolean
  persistenceIssue?: string | null
  onClose: () => void
  onAddCustomValue: (name: string, definition: string) => void
  onUpdateCustomValue: (
    valueId: CustomValueId,
    name: string,
    definition: string,
  ) => void
  onDeleteCustomValue: (valueId: CustomValueId) => void
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [addName, setAddName] = useState("")
  const [addDefinition, setAddDefinition] = useState("")
  const [isAddNameTouched, setIsAddNameTouched] = useState(false)
  const [isAddDefinitionTouched, setIsAddDefinitionTouched] = useState(false)
  const [editingValueId, setEditingValueId] = useState<CustomValueId | null>(
    null,
  )
  const [editName, setEditName] = useState("")
  const [editDefinition, setEditDefinition] = useState("")
  const [isEditNameTouched, setIsEditNameTouched] = useState(false)
  const [isEditDefinitionTouched, setIsEditDefinitionTouched] = useState(false)
  const [isConfirmingEdit, setIsConfirmingEdit] = useState(false)
  const [deletingValueId, setDeletingValueId] = useState<CustomValueId | null>(
    null,
  )
  const [isAddingCustomValue, setIsAddingCustomValue] = useState(
    openCustomValueBuilder === true,
  )
  const [highlightedValueId, setHighlightedValueId] = useState<ValueId | null>(
    initialValueId ?? null,
  )
  const addDefinitionRef = useRef<HTMLTextAreaElement>(null)

  const hasComparisons = rankedValues.some(
    ({ progress }) => progress.profileComparisons > 0,
  )
  const orderedValues = hasComparisons
    ? rankedValues
    : sortRankedValuesAlphabetically(rankedValues)
  const visibleValues = useMemo(
    () => filterRankedValuesByQuery(orderedValues, searchQuery),
    [orderedValues, searchQuery],
  )
  const existingCustomValues = useMemo(
    () =>
      rankedValues.flatMap(({ definition }) =>
        definition.kind === "custom" ? [definition] : [],
      ),
    [rankedValues],
  )
  const addValidation = useMemo(
    () =>
      validateCustomValueDraft({
        name: addName,
        definition: addDefinition,
        existingCustomValues,
      }),
    [addDefinition, addName, existingCustomValues],
  )
  const matchingAddValues = useMemo(
    () => findRankedValueNameMatches(rankedValues, addValidation.name.value),
    [addValidation.name.value, rankedValues],
  )
  const hasDuplicateAddName =
    addValidation.name.validationCode === "duplicate_name"
  const canSubmitAdd = addValidation.isValid
  const editableCustomValue = rankedValues.find(
    ({ definition }) => definition.id === editingValueId,
  )?.definition
  const editValidation = useMemo(
    () =>
      validateCustomValueDraft({
        name: editName,
        definition: editDefinition,
        existingCustomValues,
        excludedCustomValueId: editingValueId,
      }),
    [editDefinition, editName, editingValueId, existingCustomValues],
  )
  const canSubmitEdit =
    editableCustomValue?.kind === "custom" &&
    editValidation.isValid &&
    (editValidation.name.value !== editableCustomValue.name ||
      editValidation.definition.value !== editableCustomValue.definition)

  useEffect(() => {
    if (!isAddingCustomValue) {
      return
    }

    addDefinitionRef.current?.focus()
  }, [isAddingCustomValue])

  useEffect(() => {
    if (!highlightedValueId) {
      return
    }

    const valueRow = document.getElementById(
      `all-values-row-${highlightedValueId}`,
    )
    if (valueRow instanceof HTMLElement) {
      valueRow.focus()
      valueRow.scrollIntoView({ block: "center" })
    }
  }, [highlightedValueId, searchQuery, visibleValues.length])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  const handleAddCustomValue = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmitAdd || isPersistencePending) {
      return
    }

    const draft = Object.freeze({
      name: addValidation.name.value,
      definition: addValidation.definition.value,
    })
    onAddCustomValue(draft.name, draft.definition)
  }

  const startEdit = (
    valueId: CustomValueId,
    name: string,
    definition: string,
  ) => {
    setEditingValueId(valueId)
    setEditName(name)
    setEditDefinition(definition)
    setIsEditNameTouched(false)
    setIsEditDefinitionTouched(false)
    setIsConfirmingEdit(false)
  }

  const cancelEdit = () => {
    setEditingValueId(null)
    setEditName("")
    setEditDefinition("")
    setIsEditNameTouched(false)
    setIsEditDefinitionTouched(false)
    setIsConfirmingEdit(false)
  }

  const handleUpdateCustomValue = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmitEdit || !editingValueId || isPersistencePending) {
      return
    }

    setIsConfirmingEdit(true)
  }

  const confirmUpdateCustomValue = () => {
    if (!canSubmitEdit || !editingValueId || isPersistencePending) {
      return
    }

    const draft = Object.freeze({
      valueId: editingValueId,
      name: editValidation.name.value,
      definition: editValidation.definition.value,
    })
    onUpdateCustomValue(draft.valueId, draft.name, draft.definition)
  }

  const openMatchingValue = (valueId: ValueId) => {
    setIsAddingCustomValue(false)
    setSearchQuery("")
    setHighlightedValueId(valueId)
  }

  const renderRows = (values: readonly RankedValue[]) =>
    values.map(({ rank, definition, progress }) => {
      const displayName = getValueDisplayName(definition)
      const isEditing = definition.id === editingValueId
      const isDeleting = definition.id === deletingValueId
      const customValueId = definition.kind === "custom" ? definition.id : null

      return (
        <li
          key={definition.id}
          id={`all-values-row-${definition.id}`}
          tabIndex={-1}
          data-value-row="true"
          className={`text-mapache-vivid-dark overflow-x-auto overflow-y-auto border-4 border-black bg-white p-5 shadow-[8px_8px_0px_0px_#000000] outline-none sm:p-7 ${highlightedValueId === definition.id ? "ring-mapache-vivid-primary-cyan ring-8" : ""}`}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-5">
            {hasComparisons ? (
              <span
                aria-label={`Rank ${rank}`}
                className="bg-mapache-vivid-secondary-purple border-4 border-black px-3 py-2 text-2xl font-black text-white uppercase"
              >
                #{rank}
              </span>
            ) : null}
            <h3 className="min-w-0 flex-1 text-3xl font-black [overflow-wrap:anywhere] break-words uppercase sm:text-4xl">
              {displayName}
            </h3>
            {customValueId ? (
              <span className="bg-mapache-vivid-primary-cyan border-4 border-black px-3 py-2 text-lg font-black text-black uppercase">
                Yours
              </span>
            ) : null}
            <ValueLevelProgress totalXp={progress.totalXp} />
            {definition.kind === "custom" ? (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={isPersistencePending}
                  onClick={() =>
                    startEdit(
                      definition.id,
                      definition.name,
                      definition.definition,
                    )
                  }
                  className="bg-mapache-vivid-secondary-purple border-4 border-black px-3 py-2 text-lg font-black text-white uppercase focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-black"
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={isPersistencePending}
                  onClick={() => {
                    setDeletingValueId(definition.id)
                    setEditingValueId(null)
                  }}
                  className="bg-mapache-vivid-secondary-red border-4 border-black px-3 py-2 text-lg font-black text-black uppercase focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-black"
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>
          {isDeleting && customValueId ? (
            <div
              role="alertdialog"
              aria-label={`Remove ${displayName}?`}
              className="bg-mapache-vivid-secondary-red/10 mt-5 border-t-4 border-black p-4"
            >
              <h4 className="text-2xl font-black uppercase">
                Remove {displayName}?
              </h4>
              <p className="mt-3 text-lg leading-relaxed font-bold">
                This permanently removes the name, definition, and progress for
                this Custom Value. Retained values keep their levels and
                experience.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={isPersistencePending}
                  onClick={() => setDeletingValueId(null)}
                  className="bg-mapache-vivid-secondary-purple border-4 border-black px-4 py-2 font-black text-white uppercase"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isPersistencePending}
                  onClick={() => {
                    onDeleteCustomValue(customValueId)
                  }}
                  className="bg-mapache-vivid-secondary-red border-4 border-black px-4 py-2 font-black text-black uppercase"
                >
                  {isPersistencePending ? "Deleting…" : "Delete Value"}
                </button>
              </div>
            </div>
          ) : null}
          {isEditing ? (
            <form
              onSubmit={handleUpdateCustomValue}
              className="mt-5 border-t-4 border-black pt-4"
            >
              <label
                htmlFor={`custom-value-name-${definition.id}`}
                className="mb-3 block text-xl font-black uppercase"
              >
                Custom Value Name
              </label>
              <input
                id={`custom-value-name-${definition.id}`}
                value={editName}
                disabled={isPersistencePending}
                onChange={(event) => setEditName(event.target.value)}
                onBlur={() => setIsEditNameTouched(true)}
                aria-invalid={
                  isEditNameTouched &&
                  editValidation.name.validationCode !== null
                }
                aria-describedby={`custom-value-name-feedback-${definition.id}`}
                className="focus-visible:ring-mapache-vivid-primary-cyan mb-3 w-full border-4 border-black px-4 py-3 text-2xl font-bold outline-none focus-visible:ring-8"
              />
              <CustomValueFieldFeedback
                id={`custom-value-name-feedback-${definition.id}`}
                field="name"
                validation={editValidation.name}
                maximumGraphemeCount={CUSTOM_VALUE_NAME_MAX_GRAPHEMES}
                showValidationMessage={
                  isEditNameTouched ||
                  editValidation.name.validationCode === "duplicate_name"
                }
              />
              <label
                htmlFor={`custom-value-definition-${definition.id}`}
                className="mt-4 mb-3 block text-xl font-black uppercase"
              >
                Personal Definition
              </label>
              <textarea
                id={`custom-value-definition-${definition.id}`}
                value={editDefinition}
                disabled={isPersistencePending}
                onChange={(event) => setEditDefinition(event.target.value)}
                onBlur={() => setIsEditDefinitionTouched(true)}
                aria-invalid={
                  isEditDefinitionTouched &&
                  editValidation.definition.validationCode !== null
                }
                aria-describedby={`custom-value-definition-feedback-${definition.id}`}
                rows={4}
                className="focus-visible:ring-mapache-vivid-primary-cyan w-full border-4 border-black px-4 py-3 text-xl font-bold outline-none focus-visible:ring-8"
              />
              <CustomValueFieldFeedback
                id={`custom-value-definition-feedback-${definition.id}`}
                field="definition"
                validation={editValidation.definition}
                maximumGraphemeCount={CUSTOM_VALUE_DEFINITION_MAX_GRAPHEMES}
                showValidationMessage={isEditDefinitionTouched}
              />
              {isConfirmingEdit ? (
                <div
                  role="alertdialog"
                  aria-label={`Update ${displayName}?`}
                  className="border-mapache-vivid-primary-orange bg-mapache-vivid-primary-orange/15 mb-4 border-4 p-4"
                >
                  <p className="text-lg leading-relaxed font-black">
                    Earlier comparisons remain part of your progress history.
                    Updating this Custom Value starts one revised cycle and
                    clears Undo and Redo.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={isPersistencePending}
                      onClick={() => setIsConfirmingEdit(false)}
                      className="bg-mapache-vivid-secondary-purple border-4 border-black px-4 py-2 font-black text-white uppercase"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isPersistencePending}
                      onClick={confirmUpdateCustomValue}
                      className="bg-mapache-vivid-primary-orange border-4 border-black px-4 py-2 font-black text-black uppercase"
                    >
                      {isPersistencePending ? "Saving…" : "Update Value"}
                    </button>
                  </div>
                </div>
              ) : null}
              {!isConfirmingEdit ? (
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={!canSubmitEdit || isPersistencePending}
                    className="bg-mapache-vivid-secondary-green border-4 border-black px-4 py-2 font-black uppercase disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Review Update
                  </button>
                  <button
                    type="button"
                    disabled={isPersistencePending}
                    onClick={cancelEdit}
                    className="bg-mapache-vivid-secondary-red border-4 border-black px-4 py-2 font-black text-black uppercase"
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
            </form>
          ) : (
            <p className="mt-5 overflow-x-auto overflow-y-auto border-t-4 border-black pt-4 text-xl leading-relaxed font-bold [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
              “{getValueDisplayDefinition(definition)}”
            </p>
          )}
        </li>
      )
    })

  return (
    <main className="noise-bg bg-mapache-vivid-dark min-h-[100dvh] w-full text-white">
      <header className="bg-mapache-vivid-dark sticky top-0 z-20 border-b-8 border-black px-4 py-4 shadow-[0_8px_0px_0px_#000000] sm:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-mapache-vivid-primary-cyan text-4xl font-black [overflow-wrap:anywhere] break-words uppercase drop-shadow-[4px_4px_0px_#000000] sm:text-6xl">
              All Values
            </h1>
            <p className="mt-2 text-xl font-black uppercase sm:text-2xl">
              {rankedValues.length} Active Values
            </p>
          </div>
          <button
            type="button"
            disabled={isPersistencePending}
            onClick={onClose}
            className="bg-mapache-vivid-secondary-red cursor-pointer border-4 border-black px-5 py-3 text-2xl font-black uppercase shadow-[6px_6px_0px_0px_#000000] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#000000] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white active:translate-x-[6px] active:translate-y-[6px] active:shadow-none"
          >
            Close
          </button>
        </div>
      </header>

      <section
        aria-labelledby="all-values-search-heading"
        className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8"
      >
        <h2 id="all-values-search-heading" className="sr-only">
          Search all values
        </h2>
        <label
          htmlFor="all-values-search"
          className="mb-3 block text-2xl font-black uppercase"
        >
          Search All Values
        </label>
        <input
          id="all-values-search"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search by value name or definition"
          className="text-mapache-vivid-dark focus-visible:ring-mapache-vivid-primary-cyan w-full border-4 border-black bg-white px-5 py-4 text-2xl font-bold shadow-[8px_8px_0px_0px_#000000] outline-none focus-visible:ring-8"
        />
        <p
          role="status"
          aria-live="polite"
          className="mt-5 text-lg font-black uppercase"
        >
          {visibleValues.length}{" "}
          {visibleValues.length === 1 ? "Value" : "Values"} Shown
        </p>
        {persistenceIssue ? (
          <div
            role="alert"
            aria-label="Custom Value save failed"
            className="bg-mapache-vivid-primary-orange mt-6 border-4 border-black p-5 text-black shadow-[8px_8px_0px_0px_#000000]"
          >
            <h2 className="text-2xl font-black uppercase">
              That change wasn’t saved.
            </h2>
            <p className="mt-2 text-lg font-bold">
              Your current data and draft are unchanged. Review them and try
              again.
            </p>
          </div>
        ) : null}

        <section className="mt-8">
          <h2 className="text-2xl font-black uppercase">
            Custom Value Builder
          </h2>
          <p className="mt-3 max-w-3xl text-lg leading-relaxed font-bold">
            Start with an example or add your own. Each example fills an unsaved
            draft that you can edit before saving.
          </p>
          <div className="mt-5 border-4 border-black bg-white p-5 text-black shadow-[8px_8px_0px_0px_#000000]">
            <h3 className="text-xl font-black uppercase">
              Examples—not recommendations
            </h3>
            <div className="mt-4 flex flex-wrap gap-3">
              {CUSTOM_VALUE_STARTER_EXAMPLES.map(
                ({ name, label, definition }) => (
                  <button
                    key={name}
                    type="button"
                    disabled={isPersistencePending}
                    onClick={() => {
                      setAddName(name)
                      setAddDefinition(definition)
                      setIsAddNameTouched(false)
                      setIsAddDefinitionTouched(false)
                      setIsAddingCustomValue(true)
                    }}
                    className="bg-mapache-vivid-primary-cyan border-4 border-black px-4 py-3 text-lg font-black uppercase shadow-[5px_5px_0px_0px_#000000] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-black"
                  >
                    + Start with {name}
                    {label ? <span className="sr-only"> — {label}</span> : null}
                  </button>
                ),
              )}
            </div>
          </div>
          <button
            type="button"
            disabled={isPersistencePending}
            onClick={() => setIsAddingCustomValue((value) => !value)}
            className="bg-mapache-vivid-primary-orange mt-5 border-4 border-black px-5 py-3 text-xl font-black uppercase shadow-[6px_6px_0px_0px_#000000] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#000000] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white active:translate-x-[6px] active:translate-y-[6px] active:shadow-none"
          >
            {isAddingCustomValue
              ? "Close Custom Value Form"
              : "Add Custom Value"}
          </button>

          {isAddingCustomValue ? (
            <form
              aria-label="Add Custom Value"
              onSubmit={handleAddCustomValue}
              className="mt-5 flex flex-col gap-4 border-4 border-black bg-white p-6 text-black shadow-[8px_8px_0px_0px_#000000]"
            >
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="custom-value-name"
                  className="text-xl font-black uppercase"
                >
                  Custom Value Name
                </label>
                <input
                  id="custom-value-name"
                  type="text"
                  value={addName}
                  disabled={isPersistencePending}
                  onChange={(event) => setAddName(event.target.value)}
                  onBlur={() => setIsAddNameTouched(true)}
                  aria-invalid={
                    isAddNameTouched &&
                    addValidation.name.validationCode !== null
                  }
                  aria-describedby="custom-value-name-feedback"
                  className="focus-visible:ring-mapache-vivid-primary-cyan border-4 border-black px-4 py-3 text-2xl font-bold outline-none focus-visible:ring-8"
                />
                <CustomValueFieldFeedback
                  id="custom-value-name-feedback"
                  field="name"
                  validation={addValidation.name}
                  maximumGraphemeCount={CUSTOM_VALUE_NAME_MAX_GRAPHEMES}
                  showValidationMessage={
                    isAddNameTouched || hasDuplicateAddName
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="custom-value-definition"
                  className="text-xl font-black uppercase"
                >
                  Personal Definition
                </label>
                <textarea
                  ref={addDefinitionRef}
                  id="custom-value-definition"
                  value={addDefinition}
                  disabled={isPersistencePending}
                  onChange={(event) => setAddDefinition(event.target.value)}
                  onBlur={() => setIsAddDefinitionTouched(true)}
                  aria-invalid={
                    isAddDefinitionTouched &&
                    addValidation.definition.validationCode !== null
                  }
                  aria-describedby="custom-value-definition-feedback"
                  rows={4}
                  className="focus-visible:ring-mapache-vivid-primary-cyan border-4 border-black px-4 py-3 text-xl font-bold outline-none focus-visible:ring-8"
                />
                <CustomValueFieldFeedback
                  id="custom-value-definition-feedback"
                  field="definition"
                  validation={addValidation.definition}
                  maximumGraphemeCount={CUSTOM_VALUE_DEFINITION_MAX_GRAPHEMES}
                  showValidationMessage={isAddDefinitionTouched}
                />
              </div>
              {matchingAddValues.length > 0 ? (
                <div className="bg-mapache-vivid-primary-cyan/20 border-4 border-black p-4">
                  {hasDuplicateAddName ? (
                    <p className="text-lg font-black uppercase">
                      Matching value
                    </p>
                  ) : (
                    <p className="text-lg font-black uppercase">
                      Matching values
                    </p>
                  )}
                  <ul className="mt-3 flex flex-col gap-2">
                    {matchingAddValues.map(({ definition }) => (
                      <li key={definition.id}>
                        <button
                          type="button"
                          disabled={isPersistencePending}
                          onClick={() => openMatchingValue(definition.id)}
                          className="hover:text-mapache-vivid-secondary-purple border-b-4 border-black text-left text-lg font-black uppercase focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-black"
                        >
                          Open {getValueDisplayName(definition)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={!canSubmitAdd || isPersistencePending}
                  className="bg-mapache-vivid-secondary-green border-4 border-black px-5 py-3 text-xl font-black uppercase disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isPersistencePending ? "Saving…" : "Save Value"}
                </button>
                <button
                  type="button"
                  disabled={isPersistencePending}
                  onClick={() => {
                    setAddName("")
                    setAddDefinition("")
                    setIsAddNameTouched(false)
                    setIsAddDefinitionTouched(false)
                    setIsAddingCustomValue(false)
                  }}
                  className="bg-mapache-vivid-secondary-red border-4 border-black px-5 py-3 text-xl font-black text-white uppercase"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </section>

        {hasComparisons && visibleValues.some(({ rank }) => rank <= 5) ? (
          <section
            aria-labelledby="all-values-top-five-heading"
            className="mt-8"
          >
            <h2
              id="all-values-top-five-heading"
              className="border-b-4 border-black py-4 text-3xl font-black uppercase"
            >
              Top Five
            </h2>
            <ol className="mt-5 flex flex-col gap-5">
              {renderRows(visibleValues.filter(({ rank }) => rank <= 5))}
            </ol>
          </section>
        ) : null}
        {hasComparisons && visibleValues.some(({ rank }) => rank > 5) ? (
          <section aria-labelledby="all-values-other-heading" className="mt-8">
            <h2
              id="all-values-other-heading"
              className="bg-mapache-vivid-primary-cyan border-y-8 border-black px-4 py-3 text-center text-2xl font-black text-black uppercase"
            >
              All Other Values
            </h2>
            <ol className="mt-5 flex flex-col gap-5">
              {renderRows(visibleValues.filter(({ rank }) => rank > 5))}
            </ol>
          </section>
        ) : null}
        {!hasComparisons ? (
          <section aria-labelledby="included-values-heading" className="mt-8">
            <h2 id="included-values-heading" className="sr-only">
              Included Values
            </h2>
            <ol className="flex flex-col gap-5">{renderRows(visibleValues)}</ol>
          </section>
        ) : null}
        {visibleValues.length === 0 ? (
          <p className="mt-8 border-4 border-black bg-white p-8 text-center text-2xl font-black text-black shadow-[8px_8px_0px_0px_#000000]">
            No values match your search.
          </p>
        ) : null}
      </section>
    </main>
  )
}
