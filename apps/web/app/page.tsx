import GameIsland from "@/components/GameIsland"
import WebEditorialCanonicalValues from "@/components/WebEditorialCanonicalValues"
import WebEditorialInformation from "@/components/WebEditorialInformation"

export default function Page() {
  return (
    <>
      <GameIsland />
      <article
        aria-label="What Are Your Values, Mapache? information"
        className="noise-bg bg-mapache-vivid-dark text-mapache-vivid-dark px-[max(1rem,env(safe-area-inset-left,0px))] pt-[max(2.5rem,env(safe-area-inset-top,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] xl:px-[max(2rem,env(safe-area-inset-left,0px))] xl:pr-[max(2rem,env(safe-area-inset-right,0px))] xl:pb-[max(4rem,env(safe-area-inset-bottom,0px))]"
      >
        <div className="mx-auto grid max-w-7xl gap-10">
          <a
            href="#game"
            className="bg-mapache-vivid-secondary-green text-mapache-vivid-dark w-fit max-w-full min-w-0 border-4 border-black px-5 py-4 text-xl font-black uppercase shadow-[6px_6px_0px_0px_#000000] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            Start or Continue Game
          </a>
          <WebEditorialInformation />
          <WebEditorialCanonicalValues />
          <section
            id="support"
            aria-labelledby="support-title"
            className="scroll-mt-4 border-4 border-black bg-white p-5 shadow-[8px_8px_0px_0px_#000000] xl:p-8"
          >
            <h2
              id="support-title"
              className="border-b-4 border-black pb-4 text-3xl leading-tight font-black uppercase xl:text-5xl"
            >
              Support
            </h2>
            <a
              href="mailto:derekraustin+wayvm@gmail.com"
              className="bg-mapache-vivid-primary-cyan text-mapache-vivid-black! mt-6 inline-block border-4 border-black px-4 py-3 text-lg font-black uppercase shadow-[5px_5px_0px_0px_#000000] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-black"
            >
              Report a Problem
            </a>
          </section>
        </div>
      </article>
    </>
  )
}
