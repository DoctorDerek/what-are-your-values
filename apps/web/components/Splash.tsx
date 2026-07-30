"use client"

import InformationPanel from "@/components/InformationPanel"
import { introductionCopy } from "@/content/IntroductionCopy"

export default function Splash({
  announcement,
  onComplete,
}: {
  announcement?: string | null
  onComplete: () => void
}) {
  return (
    <InformationPanel
      title={introductionCopy.title}
      primaryActionLabel={introductionCopy.startAction}
      onPrimaryAction={onComplete}
    >
      <div className="flex flex-col gap-6 text-black">
        {announcement ? (
          <p
            role="status"
            className="bg-mapache-vivid-secondary-green border-4 border-black p-4 text-xl font-black"
          >
            {announcement}
          </p>
        ) : null}
        <p className="text-2xl leading-relaxed font-bold">
          {introductionCopy.tagline}
        </p>
        {introductionCopy.body.map((paragraph) => (
          <p
            key={paragraph}
            className="text-xl leading-relaxed font-medium text-gray-800"
          >
            {paragraph}
          </p>
        ))}
      </div>
    </InformationPanel>
  )
}
