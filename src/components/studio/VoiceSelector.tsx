import { useUiText } from "@/lib/i18n/ui";
import { useMemo, useState } from "react";
import { Check, ChevronDown, Mic2 } from "lucide-react";
import {
  filterVoices,
  findVoice,
  VOICE_CATALOG,
  VOICE_LANGUAGES,
  VOICE_TAGS,
} from "../../../contracts/voices";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VoicePreview } from "./VoicePreview";

export type VoiceSelectorProps = {
  value: string;
  onChange: (voice: string) => void;
  disabled?: boolean;
  id?: string;
  showPreview?: boolean;
};

export function VoiceSelector({
  value,
  onChange,
  disabled = false,
  id,
  showPreview = true,
}: VoiceSelectorProps) {
  const ui = useUiText();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("all");
  const [tag, setTag] = useState("all");
  const selected = findVoice(value);
  const matches = useMemo(
    () =>
      filterVoices("", language, tag).filter(voice =>
        [
          voice.name,
          voice.language,
          ...voice.tags,
          ui(voice.language),
          ...voice.tags.map(item => ui(item)),
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase())
      ),
    [query, language, tag, ui]
  );

  return (
    <div className="min-w-0 space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            className="flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border border-border bg-background px-3 text-left text-sm outline-none transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            aria-label={ui("Voice: {{name}}", {
              name: selected?.name || ui("Choose a voice"),
            })}
          >
            <Mic2
              className="size-3.5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate">
              {selected?.name || ui("Choose a voice")}
            </span>
            <ChevronDown
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-xl border-border bg-popover p-0 shadow-xl"
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="text-sm font-medium">{ui("Find your voice")}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {VOICE_CATALOG.length} {ui("voices ·")} {VOICE_LANGUAGES.length}{" "}
              {ui("native languages")}
            </p>
            <div className="mt-2 flex gap-2">
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger
                  size="sm"
                  aria-label={ui("Filter voices by native language")}
                  className="min-w-0 flex-1 rounded-md text-xs"
                >
                  <SelectValue placeholder={ui("All languages")} />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-64">
                  <SelectItem value="all">{ui("All languages")}</SelectItem>
                  {VOICE_LANGUAGES.map(item => (
                    <SelectItem key={item} value={item}>
                      {ui(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={tag} onValueChange={setTag}>
                <SelectTrigger
                  size="sm"
                  aria-label={ui("Filter voices by description")}
                  className="min-w-0 flex-1 rounded-md text-xs"
                >
                  <SelectValue placeholder={ui("All styles")} />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-64">
                  <SelectItem value="all">{ui("All styles")}</SelectItem>
                  {VOICE_TAGS.map(item => (
                    <SelectItem key={item} value={item}>
                      {ui(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Command shouldFilter={false}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={ui("Search narration, warm, Italian…")}
              aria-label={ui("Search voices")}
            />
            <CommandList
              className="max-h-64 p-1.5"
              aria-label={ui("Available voices")}
            >
              <CommandEmpty>
                {ui("No voices match. Try another language or style.")}
              </CommandEmpty>
              {matches.map(voice => (
                <CommandItem
                  key={voice.id}
                  value={voice.id}
                  onSelect={() => {
                    onChange(voice.id);
                    setOpen(false);
                  }}
                  className="cursor-pointer gap-2 rounded-lg px-2.5 py-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {voice.name}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                      {ui(voice.language)} ·{" "}
                      {voice.tags.map(item => ui(item)).join(" · ")}
                    </span>
                  </span>
                  {voice.id === value && (
                    <Check className="size-4 text-primary" aria-hidden="true" />
                  )}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
          <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            {matches.length} {matches.length === 1 ? ui("voice") : ui("voices")}{" "}
            {ui(
              "· ElevenLabs voices support multilingual text at a lower credit cost. Choose one, then listen to its sample."
            )}
          </p>
        </PopoverContent>
      </Popover>
      {selected && (
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
          <span>{ui(selected.language)}</span>
          {selected.tags.map(item => (
            <span key={item} className="rounded-md bg-muted px-1.5 py-0.5">
              {ui(item)}
            </span>
          ))}
        </p>
      )}
      {selected?.tags.includes("multilingual") && (
        <p className="text-[11px] text-muted-foreground">
          {ui(
            "Speaks 90+ languages, including Italian, with expressive delivery. Uses the lower voice credit rate."
          )}
        </p>
      )}
      {showPreview && selected && (
        <VoicePreview voice={value} disabled={disabled} />
      )}
    </div>
  );
}
