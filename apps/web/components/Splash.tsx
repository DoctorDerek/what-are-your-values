"use client"

import InformationPanel from "@/components/InformationPanel"
import { introductionCopy } from "@/content/IntroductionCopy"

export default function Splash({
  notice = null,
  onComplete,
}: {
  notice?: string | null
  onComplete: () => void
}) {
  return (
    <InformationPanel
      title={introductionCopy.title}
      primaryActionLabel={introductionCopy.startAction}
      onPrimaryAction={onComplete}
    >
      <div className="flex flex-col gap-6 text-black">
        {notice ? (
          <p
            role="status"
            className="bg-mapache-vivid-secondary-green text-mapache-vivid-dark border-4 border-black p-4 text-xl font-black shadow-[6px_6px_0px_0px_#000000]"
          >
            {notice}
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
