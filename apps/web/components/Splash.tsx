"use client"

export default function Splash({
  onComplete,
}: {
  onComplete: () => void
}) {
  return (
    <div className="bg-mapache-vivid-dark noise-bg flex min-h-[100dvh] w-[100dvw] flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-4xl border-4 border-black bg-white p-12 shadow-[12px_12px_0px_0px_#000000]">
        <h1 className="text-mapache-vivid-primary-cyan mb-8 text-5xl leading-tight font-black uppercase lg:text-7xl">
          What Are Your Values, Mapache?
        </h1>
        <p className="mb-6 text-2xl font-bold text-black">
          A high-speed autobattler designed to help you find your values in
          life.
        </p>
        <p className="mb-12 text-xl font-medium text-gray-800">
          Knowing your own values can help you find meaning in life, reduce
          stress, and know yourself better. This tool will sort your priorities
          in 10-15 minutes for a quick result, and under an hour for a thorough
          profile. Plus, it&apos;s fun!
        </p>

        <button
          onClick={() => onComplete()}
          className="bg-mapache-vivid-primary-orange w-full cursor-pointer border-4 border-black py-8 text-6xl font-black text-white uppercase shadow-[8px_8px_0px_0px_#000000] transition-transform active:translate-x-[8px] active:translate-y-[8px] active:shadow-none"
        >
          Start
        </button>
      </div>
    </div>
  )
}
