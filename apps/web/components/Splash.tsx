"use client"

import InformationPanel from "@/components/InformationPanel"
import { introductionCopy } from "@/content/IntroductionCopy"

export default function Splash({ onComplete }: { onComplete: () => void }) {
  return (
    <InformationPanel
      title={introductionCopy.title}
      primaryActionLabel={introductionCopy.startAction}
      onPrimaryAction={onComplete}
    >
      <div className="flex flex-col gap-6 text-black">
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
