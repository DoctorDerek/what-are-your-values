"use client"

import InformationPanel from "@/components/InformationPanel"

export default function Splash({ onComplete }: { onComplete: () => void }) {
  return (
    <InformationPanel
      title="What Are Your Values, Mapache?"
      primaryActionLabel="Start"
      onPrimaryAction={onComplete}
    >
      <div className="flex flex-col gap-6 text-black">
        <p className="text-2xl font-bold">
          A high-speed autobattler designed to help you find your values in
          life.
        </p>
        <p className="text-xl leading-relaxed font-medium text-gray-800">
          Knowing your own values can help you find meaning in life, reduce
          stress, and know yourself better. This tool will sort your priorities
          in 10-15 minutes for a quick result, and under an hour for a thorough
          profile. Plus, it&apos;s fun!
        </p>
      </div>
    </InformationPanel>
  )
}
