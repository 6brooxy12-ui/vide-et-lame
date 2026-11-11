import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Arena } from "@/game/Arena";
import { subscribeHud, type Phase } from "@/game/hud";

export const Route = createFileRoute("/")({ component: Home });

const LABEL: Record<Phase, string> = {
  prêt: "Prêt",
  armement: "Armement",
  frappe: "Frappe",
  récupération: "Récupération",
};

function Home() {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("prêt");
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    setMounted(true);
    return subscribeHud((p, l) => {
      setPhase(p);
      setLocked(l);
    });
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#0c0e12]">
      {mounted ? <Arena /> : null}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.28em] text-[#c9a36a] uppercase">Vide & Lame</p>
            <h1 className="font-serif text-xl text-[#f3efe6] sm:text-2xl">Coup d’épée</h1>
          </div>
          <div className="rounded-sm border border-[#c9a36a]/40 bg-black/40 px-3 py-2 text-right backdrop-blur-sm">
            <p className="text-[10px] tracking-widest text-[#a39888] uppercase">Phase</p>
            <p className="text-sm text-[#f3efe6]">{LABEL[phase]}</p>
          </div>
        </header>
        <div className="flex items-end justify-between gap-3">
          <p className="max-w-xs text-xs leading-relaxed text-[#c8c0b2]/90">
            {locked
              ? "Souris pour viser. Clic gauche pour frapper. Pendant l’armement, accompagne le coup pour l’accélérer."
              : "Clique dans le monde pour entrer en vue première personne, puis frappe."}
          </p>
          <button
            type="button"
            className="pointer-events-auto min-h-12 border border-[#c9a36a] bg-[#8e1c1c] px-5 text-sm tracking-wide text-[#f6efe4] uppercase sm:hidden"
            onClick={() => (window as unknown as { __slash?: () => void }).__slash?.()}
          >
            Frapper
          </button>
        </div>
      </div>
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#f3efe6]/70" />
    </main>
  );
}
