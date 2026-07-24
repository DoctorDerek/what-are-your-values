"use client"

import {
  getValueDisplayDefinition,
  getValueDisplayName,
  normalizeValueNameForComparison,
  type CustomValueId,
  type ValueId,
} from "@game/data/src/Value"
import {
  sortRankedValuesAlphabetically,
  type RankedValue,
} from "@game/data/src/ValueRanking"
import type { FormEvent } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import ValueLevelProgress from "@/components/ValueLevelProgress"

const STARTER_EXAMPLES = Object.freeze([
  Object.freeze({
    name: "Ingenuity",
    definition:
      "To solve problems in original, resourceful, and practical ways.",
    label: "Mapachito’s example",
  }),
  Object.freeze({
    name: "Destiny",
    definition: "To pursue the path I believe I am meant to fulfill.",
    label: null,
  }),
  Object.freeze({
    name: "Pets",
    definition: "To care for, protect, and share life with companion animals.",
    label: null,
  }),
])

export default function AllValues({
  rankedValues,
  initialValueId,
  openCustomValueBuilder,
  onClose,
  onAddCustomValue,
  onUpdateCustomValue,
  onDeleteCustomValue,
}: {
  rankedValues: readonly RankedValue[]
  initialValueId?: ValueId | null
  openCustomValueBuilder?: boolean
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
  const [editingValueId, setEditingValueId] = useState<CustomValueId | null>(
    null,
  )
  const [editName, setEditName] = useState("")
  const [editDefinition, setEditDefinition] = useState("")
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
  const normalizedQuery = normalizeValueNameForComparison(searchQuery)
  const visibleValues = useMemo(
    () =>
      normalizedQuery.length === 0
        ? orderedValues
        : orderedValues.filter(
            ({ definition }) =>
              normalizeValueNameForComparison(
                getValueDisplayName(definition),
              ).includes(normalizedQuery) ||
              getValueDisplayDefinition(definition)
                .toLocaleLowerCase("en-US")
                .includes(normalizedQuery),
          ),
    [normalizedQuery, orderedValues],
  )
  const normalizedValueNames = useMemo(
    () =>
      new Set(
        rankedValues.map(({ definition }) =>
          normalizeValueNameForComparison(getValueDisplayName(definition)),
        ),
      ),
    [rankedValues],
  )
  const trimmedAddName = addName.trim()
  const trimmedAddDefinition = addDefinition.trim()
  const normalizedAddName = normalizeValueNameForComparison(trimmedAddName)
  const matchingAddValues = useMemo(
    () =>
      normalizedAddName.length === 0
        ? []
        : rankedValues.filter(({ definition }) =>
            normalizeValueNameForComparison(
              getValueDisplayName(definition),
            ).includes(normalizedAddName),
          ),
    [normalizedAddName, rankedValues],
  )
  const hasDuplicateAddName =
    normalizedAddName.length > 0 && normalizedValueNames.has(normalizedAddName)
  const canSubmitAdd =
    trimmedAddName.length > 0 &&
    trimmedAddDefinition.length > 0 &&
    !hasDuplicateAddName
  const editableCustomValue = rankedValues.find(
    ({ definition }) => definition.id === editingValueId,
  )?.definition
  const normalizedEditName = normalizeValueNameForComparison(editName)
  const isDuplicateEditName =
    normalizedEditName.length > 0 &&
    rankedValues.some(
      ({ definition }) =>
        definition.id !== editingValueId &&
        normalizeValueNameForComparison(getValueDisplayName(definition)) ===
          normalizedEditName,
    )
  const canSubmitEdit =
    editableCustomValue?.kind === "custom" &&
    editName.trim().length > 0 &&
    editDefinition.trim().length > 0 &&
    (editName.trim() !== editableCustomValue.name ||
      editDefinition.trim() !== editableCustomValue.definition) &&
    !isDuplicateEditName

  useEffect(() => {
    if (!isAddingCustomValue) {
      return
    }

    addDefinitionRef.current?.focus()
  }, [isAddingCustomValue])

  useEffect(() => {
    if (openCustomValueBuilder) {
      setIsAddingCustomValue(true)
    }
  }, [openCustomValueBuilder])

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
    if (!canSubmitAdd) {
      return
    }

    onAddCustomValue(trimmedAddName, trimmedAddDefinition)
    setAddName("")
    setAddDefinition("")
    setIsAddingCustomValue(false)
  }

  const startEdit = (
    valueId: CustomValueId,
    name: string,
    definition: string,
  ) => {
    setEditingValueId(valueId)
    setEditName(name)
    setEditDefinition(definition)
    setIsConfirmingEdit(false)
  }

  const cancelEdit = () => {
    setEditingValueId(null)
    setEditName("")
    setEditDefinition("")
    setIsConfirmingEdit(false)
  }

  const handleUpdateCustomValue = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmitEdit || !editingValueId) {
      return
    }

    setIsConfirmingEdit(true)
  }

  const confirmUpdateCustomValue = () => {
    if (!canSubmitEdit || !editingValueId) {
      return
    }

    onUpdateCustomValue(editingValueId, editName.trim(), editDefinition.trim())
    cancelEdit()
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
                  onClick={() => {
                    setDeletingValueId(definition.id)
                    setEditingValueId(null)
                  }}
                  className="bg-mapache-vivid-secondary-red border-4 border-black px-3 py-2 text-lg font-black text-white uppercase focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-black"
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
                  onClick={() => setDeletingValueId(null)}
                  className="bg-mapache-vivid-secondary-purple border-4 border-black px-4 py-2 font-black text-white uppercase"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteCustomValue(customValueId)
                    setDeletingValueId(null)
                  }}
                  className="bg-mapache-vivid-secondary-red border-4 border-black px-4 py-2 font-black text-white uppercase"
                >
                  Delete Value
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
                onChange={(event) => setEditName(event.target.value)}
                className="focus-visible:ring-mapache-vivid-primary-cyan mb-3 w-full border-4 border-black px-4 py-3 text-2xl font-bold outline-none focus-visible:ring-8"
              />
              <label
                htmlFor={`custom-value-definition-${definition.id}`}
                className="mb-3 block text-xl font-black uppercase"
              >
                Personal Definition
              </label>
              <textarea
                id={`custom-value-definition-${definition.id}`}
                value={editDefinition}
                onChange={(event) => setEditDefinition(event.target.value)}
                rows={4}
                className="focus-visible:ring-mapache-vivid-primary-cyan mb-4 w-full border-4 border-black px-4 py-3 text-xl font-bold outline-none focus-visible:ring-8"
              />
              {isDuplicateEditName ? (
                <p
                  role="status"
                  className="border-mapache-vivid-secondary-red bg-mapache-vivid-secondary-red/15 text-mapache-vivid-secondary-red rounded-sm border-4 p-3 text-base font-black uppercase"
                >
                  This value already exists. Open it instead.
                </p>
              ) : null}
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
                      onClick={() => setIsConfirmingEdit(false)}
                      className="bg-mapache-vivid-secondary-purple border-4 border-black px-4 py-2 font-black text-white uppercase"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={confirmUpdateCustomValue}
                      className="bg-mapache-vivid-primary-orange border-4 border-black px-4 py-2 font-black text-white uppercase"
                    >
                      Update Value
                    </button>
                  </div>
                </div>
              ) : null}
              {!isConfirmingEdit ? (
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={!canSubmitEdit}
                    className="bg-mapache-vivid-secondary-green border-4 border-black px-4 py-2 font-black uppercase disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Review Update
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="bg-mapache-vivid-secondary-red border-4 border-black px-4 py-2 font-black text-white uppercase"
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
              {STARTER_EXAMPLES.map(({ name, label, definition }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setAddName(name)
                    setAddDefinition(definition)
                    setIsAddingCustomValue(true)
                  }}
                  className="bg-mapache-vivid-primary-cyan border-4 border-black px-4 py-3 text-lg font-black uppercase shadow-[5px_5px_0px_0px_#000000] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-black"
                >
                  + Start with {name}
                  {label ? <span className="sr-only"> — {label}</span> : null}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
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
              <label
                htmlFor="custom-value-name"
                className="flex flex-col gap-2"
              >
                <span className="text-xl font-black uppercase">
                  Custom Value Name
                </span>
                <input
                  id="custom-value-name"
                  type="text"
                  value={addName}
                  onChange={(event) => setAddName(event.target.value)}
                  className="focus-visible:ring-mapache-vivid-primary-cyan border-4 border-black px-4 py-3 text-2xl font-bold outline-none focus-visible:ring-8"
                />
              </label>
              <label
                htmlFor="custom-value-definition"
                className="flex flex-col gap-2"
              >
                <span className="text-xl font-black uppercase">
                  Personal Definition
                </span>
                <textarea
                  ref={addDefinitionRef}
                  id="custom-value-definition"
                  value={addDefinition}
                  onChange={(event) => setAddDefinition(event.target.value)}
                  rows={4}
                  className="focus-visible:ring-mapache-vivid-primary-cyan border-4 border-black px-4 py-3 text-xl font-bold outline-none focus-visible:ring-8"
                />
              </label>
              {matchingAddValues.length > 0 ? (
                <div className="bg-mapache-vivid-primary-cyan/20 border-4 border-black p-4">
                  {hasDuplicateAddName ? (
                    <p className="text-lg font-black uppercase">
                      This value already exists. Open it instead.
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
                  disabled={!canSubmitAdd}
                  className="bg-mapache-vivid-secondary-green border-4 border-black px-5 py-3 text-xl font-black uppercase disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Save Value
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddName("")
                    setAddDefinition("")
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
