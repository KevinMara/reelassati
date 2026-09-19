import { useEffect, useId, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, BookOpen, Keyboard, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  getPageGuide,
  type GuideLanguage,
  type PageGuide,
} from "@/lib/page-guides";

interface PageGuideButtonProps {
  className?: string;
  compact?: boolean;
}

/** The route owns the guide; pages do not have to maintain separate help state. */
export function PageGuideButton(props: PageGuideButtonProps) {
  const location = useLocation();
  const guide = getPageGuide(location.pathname, location.search);
  if (!guide) return null;

  return (
    <PageGuideDialog
      key={`${location.pathname}${location.search}`}
      guide={guide}
      {...props}
    />
  );
}

/** Dashboard uses its header slot; the remaining routes use one small launcher. */
export function PublicPageGuide() {
  const { pathname } = useLocation();
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/"))
    return null;
  return (
    <PageGuideButton className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 rounded-full border-border bg-surface px-3.5 shadow-md" />
  );
}

function PageGuideDialog({
  guide,
  className,
  compact = false,
}: PageGuideButtonProps & { guide: PageGuide }) {
  const { i18n } = useTranslation();
  const language: GuideLanguage = (
    i18n.resolvedLanguage || i18n.language
  ).startsWith("it")
    ? "it"
    : "en";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchId = useId();
  const isItalian = language === "it";
  const guideLabel = isItalian ? "Guida" : "Guide";
  const title = guide.title[language];
  const normalizedQuery = query.trim().toLocaleLowerCase(language);
  const visibleSections = guide.sections.filter(item =>
    `${item.title[language]} ${item.body[language]}`
      .toLocaleLowerCase(language)
      .includes(normalizedQuery)
  );
  const visibleShortcuts = (guide.shortcuts ?? []).filter(item =>
    `${item.keys} ${item.action[language]}`
      .toLocaleLowerCase(language)
      .includes(normalizedQuery)
  );
  const hasResults = visibleSections.length > 0 || visibleShortcuts.length > 0;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.key !== "?" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      const target = event.target instanceof Element ? event.target : null;
      if (
        target?.closest(
          "input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox'], [role='combobox'], [role='dialog'], [role='listbox'], [role='menu']"
        )
      )
        return;
      // Do not place a guide above another modal, including a dialog with focus on its backdrop.
      if (
        document.querySelector(
          "[role='dialog'][data-state='open'], [role='alertdialog'][data-state='open'], [aria-modal='true']"
        )
      )
        return;
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={isItalian ? `Guida: ${title}` : `Guide: ${title}`}
          aria-keyshortcuts="?"
          title={`${guideLabel}: ${title} (?)`}
          className={cn(
            "h-9 gap-1.5 border-border bg-background/80 text-foreground/75 hover:text-foreground",
            className
          )}
        >
          <BookOpen className="h-4 w-4" aria-hidden />
          <span className={compact ? "hidden sm:inline" : undefined}>
            {guideLabel}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(85dvh,48rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-5 pb-4 pt-5 text-left sm:px-6">
          <p className="mb-1 flex items-center gap-2 text-xs font-medium text-primary">
            <BookOpen className="h-4 w-4" aria-hidden />
            {isItalian ? "Guida alla pagina" : "Page guide"}
          </p>
          <DialogTitle className="pr-8 text-xl leading-tight">
            {title}
          </DialogTitle>
          <DialogDescription className="pr-5 leading-relaxed">
            {guide.description[language]}
          </DialogDescription>
          {guide.sections.length > 4 || guide.shortcuts ? (
            <div className="relative mt-2">
              <label htmlFor={searchId} className="sr-only">
                {isItalian ? "Cerca nella guida" : "Find in this guide"}
              </label>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50"
                aria-hidden
              />
              <input
                id={searchId}
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={
                  isItalian
                    ? "Cerca strumenti o scorciatoie…"
                    : "Find a tool or shortcut…"
                }
                className="h-9 w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
              />
            </div>
          ) : null}
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          {visibleSections.length > 0 ? (
            <ol className="space-y-5">
              {visibleSections.map(item => (
                <li key={item.title.en} className="flex gap-3">
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs text-primary"
                    aria-hidden
                  >
                    {guide.sections.indexOf(item) + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold leading-6">
                      {item.title[language]}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-foreground/70">
                      {item.body[language]}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : null}
          {visibleShortcuts.length > 0 ? (
            <section
              aria-labelledby={`${searchId}-shortcuts`}
              className={cn(
                "rounded-xl border border-border bg-surface p-4",
                visibleSections.length > 0 && "mt-6"
              )}
            >
              <h3
                id={`${searchId}-shortcuts`}
                className="mb-1 flex items-center gap-2 text-sm font-semibold"
              >
                <Keyboard className="h-4 w-4 text-primary" aria-hidden />
                {isItalian ? "Scorciatoie da tastiera" : "Keyboard shortcuts"}
              </h3>
              <p className="mb-4 text-xs leading-relaxed text-foreground/60">
                {isItalian
                  ? "Le scorciatoie del montaggio sono attive quando non scrivi in un campo o in una finestra di dialogo."
                  : "Editing shortcuts work when you are not typing in a field or using a dialog."}
              </p>
              <dl className="space-y-3">
                {visibleShortcuts.map(shortcut => (
                  <div
                    key={shortcut.keys}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-xs"
                  >
                    <dt className="text-foreground/75">
                      {shortcut.action[language]}
                    </dt>
                    <dd>
                      <kbd className="inline-block rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground">
                        {shortcut.keys}
                      </kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
          {!hasResults ? (
            <p
              role="status"
              className="py-6 text-center text-sm text-foreground/65"
            >
              {isItalian
                ? "Nessuna voce trovata. Prova un’altra parola o cancella la ricerca."
                : "No matching guide entries. Try another word or clear the search."}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface/60 px-5 py-4 sm:px-6">
          <Link
            to="/contact"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-primary"
          >
            {isItalian ? "Chiedi all’assistenza" : "Ask support"}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-foreground/50 sm:inline">
              {isItalian ? "Riapri con" : "Reopen with"}{" "}
              <kbd className="rounded border border-border px-1 font-mono">
                ?
              </kbd>
            </span>
            <DialogClose asChild>
              <Button type="button" size="sm">
                {isItalian ? "Ho capito" : "Got it"}
              </Button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
