"use client"

import {
  CONTROL_ACTION_LABELS,
  CONTROL_SEMANTIC_ACTIONS,
  CONTROLS_COPY,
  WEB_CONTROL_GROUPS,
} from "@game/data/src/Controls"
import type { ComponentProps } from "react"
import { ReopenedInformationPanel } from "@/components/InformationPanel"

export default function Controls({
  open,
  onOpenChange,
  onCloseAutoFocus,
}: Readonly<{
  open: boolean
  onOpenChange: (open: boolean) => void
  onCloseAutoFocus?: ComponentProps<
    typeof ReopenedInformationPanel
  >["onCloseAutoFocus"]
}>) {
  return (
    <ReopenedInformationPanel
      open={open}
      accessibleCloseLabel={CONTROLS_COPY.closeAction}
      primaryActionLabel={CONTROLS_COPY.closeAction}
      title={CONTROLS_COPY.title}
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenChange={onOpenChange}
      onPrimaryAction={() => onOpenChange(false)}
    >
      <div className="grid gap-8 text-left text-black">
        <p className="text-xl leading-relaxed font-bold">
          {CONTROLS_COPY.introduction}
        </p>

        <section className="grid gap-4">
          <h2 className="text-3xl leading-tight font-black">
            {CONTROLS_COPY.semanticActionsHeading}
          </h2>
          <dl className="grid gap-4">
            {CONTROL_SEMANTIC_ACTIONS.map((action) => (
              <div
                key={action.id}
                className="border-l-8 border-black bg-gray-100 px-4 py-3"
              >
                <dt className="text-xl leading-tight font-black">
                  {CONTROL_ACTION_LABELS[action.id]}
                </dt>
                <dd className="mt-1 text-lg leading-relaxed font-medium text-gray-800">
                  {action.description}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="grid gap-5">
          <h2 className="text-3xl leading-tight font-black">
            {CONTROLS_COPY.bindingsHeading}
          </h2>
          {WEB_CONTROL_GROUPS.map((group) => (
            <section key={group.id} className="grid gap-3">
              <h3 className="text-2xl leading-tight font-black">
                {group.title}
              </h3>
              <dl className="grid gap-3">
                {group.bindings.map((binding) => (
                  <div
                    key={`${group.id}:${binding.actionId}`}
                    className="grid gap-1 border-4 border-black p-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] xl:items-baseline xl:gap-6"
                  >
                    <dt className="text-lg leading-tight font-black [overflow-wrap:anywhere]">
                      {CONTROL_ACTION_LABELS[binding.actionId]}
                    </dt>
                    <dd className="text-lg leading-relaxed font-medium [overflow-wrap:anywhere] text-gray-800">
                      {binding.input}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </section>
      </div>
    </ReopenedInformationPanel>
  )
}
