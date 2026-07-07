import { Importer } from "@/components/importer";

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_55%,_#020617_100%)] text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
              GrowEasy SDE Challenge
            </p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              AI-powered CSV importer for messy lead exports
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Upload any valid CSV, preview the raw rows instantly, and convert the data into
              GrowEasy CRM format only after confirmation.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-6 backdrop-blur">
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoChip label="Frontend" value="Next.js" />
              <InfoChip label="Backend" value="Express + TypeScript" />
              <InfoChip label="Parsing" value="Papa Parse" />
              <InfoChip label="AI" value="OpenAI with retry + fallback" />
            </div>
          </div>
        </section>

        <Importer />
      </div>
    </main>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 font-medium text-white">{value}</p>
    </div>
  );
}
