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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("all");
  const [tag, setTag] = useState("all");
  const selected = findVoice(value);
  const matches = useMemo(
    () => filterVoices(query, language, tag),
    [query, language, tag]
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
            aria-label={`Voice: ${selected?.name || "Choose a voice"}`}
          >
            <Mic2
              className="size-3.5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate">
              {selected?.name || "Choose a voice"}
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
            <p className="text-sm font-medium">Find your voice</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {VOICE_CATALOG.length} voices · {VOICE_LANGUAGES.length} native
              languages
            </p>
            <div className="mt-2 flex gap-2">
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger
                  size="sm"
                  aria-label="Filter voices by native language"
                  className="min-w-0 flex-1 rounded-md text-xs"
                >
                  <SelectValue placeholder="All languages" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-64">
                  <SelectItem value="all">All languages</SelectItem>
                  {VOICE_LANGUAGES.map(item => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={tag} onValueChange={setTag}>
                <SelectTrigger
                  size="sm"
                  aria-label="Filter voices by description"
                  className="min-w-0 flex-1 rounded-md text-xs"
                >
                  <SelectValue placeholder="All styles" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-64">
                  <SelectItem value="all">All styles</SelectItem>
                  {VOICE_TAGS.map(item => (
                    <SelectItem key={item} value={item}>
                      {item}
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
              placeholder="Search narration, warm, Italian…"
              aria-label="Search voices"
            />
            <CommandList
              className="max-h-64 p-1.5"
              aria-label="Available voices"
            >
              <CommandEmpty>
                No voices match. Try another language or style.
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
                      {voice.language} · {voice.tags.join(" · ")}
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
            {matches.length} {matches.length === 1 ? "voice" : "voices"} ·
            Choose one, then listen to its sample.
          </p>
        </PopoverContent>
      </Popover>
      {selected && (
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
          <span>{selected.language}</span>
          {selected.tags.map(item => (
            <span key={item} className="rounded-md bg-muted px-1.5 py-0.5">
              {item}
            </span>
          ))}
        </p>
      )}
      {showPreview && selected && (
        <VoicePreview voice={value} disabled={disabled} />
      )}
    </div>
  );
}
