"use client"

import {
  getValueDisplayDefinition,
  getValueDisplayName,
  type CustomValueId,
} from "@game/data/src/Value"
import type { RankedValue } from "@game/data/src/ValueRanking"
import type { FormEvent } from "react"
import { useEffect, useMemo, useState } from "react"
import ValueLevelProgress from "@/components/ValueLevelProgress"

export default function AllValues({
  rankedValues,
  onClose,
  onAddCustomValue,
  onUpdateCustomValue,
}: {
  rankedValues: readonly RankedValue[]
  onClose: () => void
  onAddCustomValue: (name: string, definition: string) => void
  onUpdateCustomValue: (
    valueId: CustomValueId,
    name: string,
    definition: string,
  ) => void
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [addName, setAddName] = useState("")
  const [addDefinition, setAddDefinition] = useState("")
  const [editingValueId, setEditingValueId] = useState<CustomValueId | null>(
    null,
  )
  const [editName, setEditName] = useState("")
  const [editDefinition, setEditDefinition] = useState("")
  const [isAddingCustomValue, setIsAddingCustomValue] = useState(false)

  const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
  const visibleValues = useMemo(
    () =>
      normalizedQuery.length === 0
        ? rankedValues
        : rankedValues.filter(
            ({ definition }) =>
              getValueDisplayName(definition)
                .toLocaleLowerCase()
                .includes(normalizedQuery) ||
              getValueDisplayDefinition(definition)
                .toLocaleLowerCase()
                .includes(normalizedQuery),
          ),
    [normalizedQuery, rankedValues],
  )
  const hasComparisons = rankedValues.some(
    ({ progress }) => progress.profileComparisons > 0,
  )
  const normalizedValueNames = useMemo(
    () =>
      new Set(
        rankedValues.map((value) =>
          getValueDisplayName(value.definition).toLocaleLowerCase().trim(),
        ),
      ),
    [rankedValues],
  )
  const trimmedAddName = addName.trim()
  const trimmedAddDefinition = addDefinition.trim()
  const normalizedAddName = trimmedAddName.toLocaleLowerCase()
  const hasDuplicateAddName =
    normalizedAddName.length > 0 && normalizedValueNames.has(normalizedAddName)
  const canSubmitAdd =
    trimmedAddName.length > 0 &&
    trimmedAddDefinition.length > 0 &&
    !hasDuplicateAddName
  const editableCustomValue = rankedValues.find(
    ({ definition }) => definition.id === editingValueId,
  )?.definition
  const normalizedEditName = editName.trim().toLocaleLowerCase()
  const isDuplicateEditName =
    normalizedEditName.length > 0 &&
    rankedValues.some(
      ({ definition }) =>
        definition.id !== editingValueId &&
        getValueDisplayName(definition).toLocaleLowerCase().trim() ===
          normalizedEditName,
    )
  const canSubmitEdit =
    editableCustomValue?.kind === "custom" &&
    editName.trim().length > 0 &&
    editDefinition.trim().length > 0 &&
    (editName.trim() !== editableCustomValue.name ||
      editDefinition.trim() !== editableCustomValue.definition) &&
    !isDuplicateEditName
  const normalizedAddLabel = `add-custom-value-${normalizedQuery}`

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
  }

  const cancelEdit = () => {
    setEditingValueId(null)
    setEditName("")
    setEditDefinition("")
  }

  const handleUpdateCustomValue = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmitEdit || !editingValueId) {
      return
    }

    onUpdateCustomValue(editingValueId, editName.trim(), editDefinition.trim())
    cancelEdit()
  }

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
          Search the current ranking
        </h2>
        <label
          htmlFor="all-values-search"
          className="mb-3 block text-2xl font-black uppercase"
        >
          Search Values
        </label>
        <input
          id="all-values-search"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search by value name"
          className="text-mapache-vivid-dark focus-visible:ring-mapache-vivid-primary-cyan w-full border-4 border-black bg-white px-5 py-4 text-2xl font-bold shadow-[8px_8px_0px_0px_#000000] outline-none focus-visible:ring-8"
        />
        <p
          role="status"
          aria-live="polite"
          className="mt-5 text-lg font-black uppercase"
        >
          {visibleValues.length}{" "}
          {visibleValues.length === 1 ? "Value Shown" : "Values Shown"}
        </p>

        <section className="mt-8">
          <h3 className="text-2xl font-black uppercase">
            Custom Value Builder
          </h3>
          <button
            type="button"
            onClick={() => {
              setIsAddingCustomValue((value) => !value)
            }}
            className="bg-mapache-vivid-primary-orange mt-3 border-4 border-black px-5 py-3 text-xl font-black uppercase shadow-[6px_6px_0px_0px_#000000] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#000000] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white active:translate-x-[6px] active:translate-y-[6px] active:shadow-none"
          >
            {isAddingCustomValue
              ? "Close Custom Value Form"
              : "Add Custom Value"}
          </button>

          {isAddingCustomValue ? (
            <form
              aria-label={normalizedAddLabel}
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
                  Custom Value Definition
                </span>
                <textarea
                  id="custom-value-definition"
                  value={addDefinition}
                  onChange={(event) => setAddDefinition(event.target.value)}
                  rows={4}
                  className="focus-visible:ring-mapache-vivid-primary-cyan border-4 border-black px-4 py-3 text-xl font-bold outline-none focus-visible:ring-8"
                />
              </label>
              {hasDuplicateAddName ? (
                <p
                  role="status"
                  className="border-mapache-vivid-secondary-red bg-mapache-vivid-secondary-red/15 text-mapache-vivid-secondary-red rounded-sm border-4 p-3 text-lg font-black uppercase"
                >
                  A value with this name already exists.
                </p>
              ) : null}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={!canSubmitAdd}
                  className="bg-mapache-vivid-secondary-green border-4 border-black px-5 py-3 text-xl font-black uppercase disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Save Custom Value
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddName("")
                    setAddDefinition("")
                    setIsAddingCustomValue(false)
                  }}
                  className="bg-mapache-vivid-secondary-red border-4 border-black px-5 py-3 text-xl font-black uppercase"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </section>

        {visibleValues.length > 0 ? (
          <ol className="mt-8 flex flex-col gap-5">
            {visibleValues.map(({ rank, definition, progress }) => {
              const displayName = getValueDisplayName(definition)
              const isTopFive = hasComparisons && rank <= 5
              const isEditing = definition.id === editingValueId

              return (
                <li
                  key={definition.id}
                  className="text-mapache-vivid-dark overflow-x-auto overflow-y-auto border-4 border-black bg-white p-5 shadow-[8px_8px_0px_0px_#000000] sm:p-7"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-5">
                    <span
                      aria-label={`Rank ${rank}`}
                      className="bg-mapache-vivid-secondary-purple border-4 border-black px-3 py-2 text-2xl font-black text-white uppercase"
                    >
                      #{rank}
                    </span>
                    <h3 className="min-w-0 flex-1 text-3xl font-black [overflow-wrap:anywhere] break-words uppercase sm:text-4xl">
                      {displayName}
                    </h3>
                    {isTopFive ? (
                      <span className="bg-mapache-vivid-primary-orange border-4 border-black px-3 py-2 text-lg font-black text-white uppercase">
                        Top Five
                      </span>
                    ) : null}
                    {definition.kind === "custom" ? (
                      <span className="bg-mapache-vivid-primary-cyan border-4 border-black px-3 py-2 text-lg font-black text-black uppercase">
                        Yours
                      </span>
                    ) : null}
                    <ValueLevelProgress totalXp={progress.totalXp} />
                    {definition.kind === "custom" ? (
                      <button
                        type="button"
                        onClick={() =>
                          startEdit(
                            definition.id,
                            definition.name,
                            definition.definition,
                          )
                        }
                        className="bg-mapache-vivid-secondary-purple border-4 border-black px-3 py-2 text-lg font-black uppercase"
                      >
                        Edit
                      </button>
                    ) : null}
                  </div>
                  {isEditing ? (
                    <form
                      onSubmit={handleUpdateCustomValue}
                      className="mt-5 border-t-4 border-black pt-4"
                    >
                      <label
                        htmlFor={`custom-value-name-${definition.id}`}
                        className="mb-3 block text-xl font-black uppercase"
                      >
                        Name
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
                        Definition
                      </label>
                      <textarea
                        id={`custom-value-definition-${definition.id}`}
                        value={editDefinition}
                        onChange={(event) =>
                          setEditDefinition(event.target.value)
                        }
                        rows={4}
                        className="focus-visible:ring-mapache-vivid-primary-cyan mb-4 w-full border-4 border-black px-4 py-3 text-xl font-bold outline-none focus-visible:ring-8"
                      />
                      {isDuplicateEditName ? (
                        <p
                          role="status"
                          className="border-mapache-vivid-secondary-red bg-mapache-vivid-secondary-red/15 text-mapache-vivid-secondary-red rounded-sm border-4 p-3 text-base font-black uppercase"
                        >
                          A value with this name already exists.
                        </p>
                      ) : null}
                      <div className="flex gap-3">
                        <button
                          type="submit"
                          disabled={!canSubmitEdit}
                          className="bg-mapache-vivid-secondary-green border-4 border-black px-4 py-2 font-black uppercase disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="bg-mapache-vivid-secondary-red border-4 border-black px-4 py-2 font-black uppercase"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p className="mt-5 overflow-x-auto overflow-y-auto border-t-4 border-black pt-4 text-xl leading-relaxed font-bold [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
                      “{getValueDisplayDefinition(definition)}”
                    </p>
                  )}
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="mt-8 border-4 border-black bg-white p-8 text-center text-2xl font-black text-black shadow-[8px_8px_0px_0px_#000000]">
            No values match your search.
          </p>
        )}
      </section>
    </main>
  )
}
