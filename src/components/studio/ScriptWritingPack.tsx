import { useUiText } from "@/lib/i18n/ui";
import type { ScriptWritingPack as WritingPack } from "@contracts/script-writing-pack";
import { withoutTextProvenanceMarker } from "@contracts/compliance";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const seconds = (value: number) => Number(value.toFixed(1)).toString();
const spokenText = (value: string) =>
  withoutTextProvenanceMarker(value).replace(/\s+/g, " ").trim();

export function ScriptBeatTable({ beats }: { beats: WritingPack["beats"] }) {
  const ui = useUiText();
  return (
    <div
      role="region"
      aria-label={ui("Planned script beats")}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users need to focus this named scrolling table region.
      tabIndex={0}
      className="max-h-[28rem] max-w-full overflow-auto rounded-lg border border-border"
    >
      <table className="w-full min-w-[620px] table-fixed text-left text-xs">
        <caption className="sr-only">
          {ui(
            "Planned script timing in seconds, spoken lines, screen text and visual direction"
          )}
        </caption>
        <thead className="sticky top-0 bg-background text-foreground/70">
          <tr>
            <th scope="col" className="w-24 px-3 py-2 font-medium">
              {ui("Planned time")}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {ui("Spoken")}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {ui("On screen")}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {ui("Visual")}
            </th>
          </tr>
        </thead>
        <tbody>
          {beats.map((beat, index) => (
            <tr key={index} className="border-t border-border align-top">
              <th scope="row" className="px-3 py-3 font-normal tabular-nums">
                <span className="block">
                  {seconds(beat.start)}–{seconds(beat.end)}s
                </span>
                <span className="mt-1 block text-foreground/60">
                  {seconds(beat.end - beat.start)}s
                </span>
              </th>
              <td className="break-words px-3 py-3 leading-relaxed">
                {beat.spoken}
              </td>
              <td className="break-words px-3 py-3 leading-relaxed">
                {beat.screenText || "—"}
              </td>
              <td className="break-words px-3 py-3 leading-relaxed text-foreground/70">
                {beat.visual}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ScriptCtaOptions({
  ctas,
  currentCta,
  onUseCta,
  disabled = false,
}: {
  ctas: WritingPack["alternateCtas"];
  currentCta: string;
  onUseCta(cta: string): void;
  disabled?: boolean;
}) {
  const ui = useUiText();
  return (
    <ol className="space-y-3">
      {ctas.map((cta, index) => {
        const selected = currentCta === cta;
        return (
          <li
            key={index}
            className="rounded-lg border border-border bg-background p-3"
          >
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {cta}
            </p>
            <button
              type="button"
              aria-label={`Use call to action ${index + 1}`}
              aria-pressed={selected}
              disabled={disabled || selected}
              onClick={() => onUseCta(cta)}
              className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:border-primary/50 disabled:opacity-50"
            >
              {selected
                ? ui("Current call to action")
                : ui("Use this call to action")}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function ScriptWritingPack({
  pack,
  fullScript,
  currentHook,
  currentCta,
  onUseHook,
  onUseCta,
  disabled = false,
}: {
  pack?: WritingPack;
  fullScript: string;
  currentHook: string;
  currentCta: string;
  onUseHook(hook: string): void;
  onUseCta(cta: string): void;
  disabled?: boolean;
}) {
  const ui = useUiText();
  if (!pack)
    return (
      <p className="mt-5 text-xs leading-relaxed text-foreground/60">
        {ui(
          "No writing plan is stored with this draft. You can still edit and save its script."
        )}
      </p>
    );
  const edited = spokenText(pack.scriptText) !== spokenText(fullScript);
  return (
    <section
      aria-label={ui("Generated writing plan")}
      className="mt-6 min-w-0 border-t border-border pt-5"
    >
      <h2 className="text-sm font-medium">{ui("Writing options")}</h2>
      <p className="mt-1 text-xs leading-relaxed text-foreground/65">
        {ui(
          "Hooks are ranked for fit with this brief. Beat timing is a plan; recorded speech may differ."
        )}
      </p>
      {edited ? (
        <p
          role="status"
          className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-relaxed text-foreground/75"
        >
          {ui(
            "The spoken script has changed. These generated options remain available; revise the beat plan before using it with the edited narration."
          )}
        </p>
      ) : null}
      <Tabs defaultValue="hooks" className="mt-4 min-w-0">
        <TabsList
          aria-label={ui("Writing options")}
          className="grid h-auto w-full grid-cols-3 bg-background p-1"
        >
          <TabsTrigger value="hooks" className="py-2 text-xs">
            {ui("10 hooks")}
          </TabsTrigger>
          <TabsTrigger value="beats" className="py-2 text-xs">
            {ui("Beat plan")}
          </TabsTrigger>
          <TabsTrigger value="ctas" className="py-2 text-xs">
            {ui("Other CTAs")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="hooks" className="min-w-0 pt-2">
          <ol
            className="max-h-[28rem] space-y-2 overflow-y-auto pr-1"
            aria-label={ui("Ranked hook alternatives")}
          >
            {pack.hooks.map(hook => {
              const selected = currentHook === hook.spoken;
              return (
                <li
                  key={hook.rank}
                  className="rounded-lg border border-border bg-background p-3"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-medium text-primary"
                      aria-label={`Rank ${hook.rank}`}
                    >
                      {hook.rank}
                    </span>
                    <p className="min-w-0 whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {hook.spoken}
                    </p>
                  </div>
                  <details className="mt-2 pl-9 text-xs text-foreground/70">
                    <summary className="cursor-pointer py-1 focus-visible:outline-primary">
                      {ui("Screen text and selection reason")}
                    </summary>
                    <dl className="mt-2 space-y-2 break-words leading-relaxed">
                      <div>
                        <dt className="font-medium">{ui("On screen")}</dt>
                        <dd className="mt-0.5">{hook.screenText}</dd>
                      </div>
                      <div>
                        <dt className="font-medium">
                          {ui("Creative selection")}
                        </dt>
                        <dd className="mt-0.5">{hook.reason}</dd>
                      </div>
                    </dl>
                  </details>
                  <button
                    type="button"
                    aria-label={`Use hook ${hook.rank}`}
                    aria-pressed={selected}
                    disabled={disabled || selected}
                    onClick={() => onUseHook(hook.spoken)}
                    className="ml-9 mt-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:border-primary/50 disabled:opacity-50"
                  >
                    {selected ? ui("Current opening") : ui("Use this opening")}
                  </button>
                </li>
              );
            })}
          </ol>
        </TabsContent>
        <TabsContent value="beats" className="min-w-0 pt-2">
          <p className="mb-3 text-xs leading-relaxed text-foreground/65">
            {ui(
              "Planned seconds, spoken lines and production direction. Review the timings after recording."
            )}
          </p>
          <ScriptBeatTable beats={pack.beats} />
        </TabsContent>
        <TabsContent value="ctas" className="min-w-0 pt-2">
          <ScriptCtaOptions
            ctas={pack.alternateCtas}
            currentCta={currentCta}
            onUseCta={onUseCta}
            disabled={disabled}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
