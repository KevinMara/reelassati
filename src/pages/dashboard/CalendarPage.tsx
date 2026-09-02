import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import type {
  CalendarEvent,
  CalendarEventKind,
  Platform,
  ScheduledPost,
} from "@contracts/workspace";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/providers/workspace";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const PLATFORM_META: Record<Platform, { label: string; dot: string }> = {
  tiktok: { label: "TikTok", dot: "bg-slate-950" },
  instagram: { label: "Instagram", dot: "bg-pink-500" },
  youtube: { label: "YouTube", dot: "bg-red-600" },
  twitter: { label: "X / Twitter", dot: "bg-slate-600" },
  facebook: { label: "Facebook", dot: "bg-blue-600" },
  linkedin: { label: "LinkedIn", dot: "bg-blue-700" },
  pinterest: { label: "Pinterest", dot: "bg-red-700" },
  threads: { label: "Threads", dot: "bg-zinc-700" },
};

const EVENT_KIND_META: Record<
  CalendarEventKind,
  { label: string; dot: string; accent: string }
> = {
  task: {
    label: "Task",
    dot: "bg-violet-500",
    accent: "border-violet-500/20 bg-violet-500/10",
  },
  shoot: {
    label: "Shoot",
    dot: "bg-fuchsia-500",
    accent: "border-fuchsia-500/20 bg-fuchsia-500/10",
  },
  meeting: {
    label: "Meeting",
    dot: "bg-sky-500",
    accent: "border-sky-500/20 bg-sky-500/10",
  },
  deadline: {
    label: "Deadline",
    dot: "bg-amber-500",
    accent: "border-amber-500/20 bg-amber-500/10",
  },
  other: {
    label: "Other",
    dot: "bg-emerald-500",
    accent: "border-emerald-500/20 bg-emerald-500/10",
  },
};

type EventForm = {
  title: string;
  notes: string;
  date: string;
  startTime: string;
  endTime: string;
  kind: CalendarEventKind;
  allDay: boolean;
};

type CalendarItem =
  | { type: "event"; event: CalendarEvent }
  | { type: "post"; post: ScheduledPost };

function dateKey(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const valueFor = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)?.value || "";
  return `${valueFor("year")}-${valueFor("month")}-${valueFor("day")}`;
}

function timeLabel(value: string, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function postDate(post: ScheduledPost) {
  return post.scheduledAt || post.publishedAt;
}

function postTitle(post: ScheduledPost) {
  const trimmed = post.caption.trim();
  if (!trimmed) return "Untitled publication";
  return trimmed.length > 58 ? `${trimmed.slice(0, 58)}…` : trimmed;
}

function itemSortKey(item: CalendarItem) {
  if (item.type === "event") {
    return `${item.event.date}T${item.event.startTime || "00:00"}`;
  }
  return postDate(item.post) || "";
}

function emptyForm(date: string): EventForm {
  return {
    title: "",
    notes: "",
    date,
    startTime: "09:00",
    endTime: "",
    kind: "task",
    allDay: true,
  };
}

function createId(prefix: string) {
  const value =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${value}`;
}

export default function CalendarPage() {
  const { workspace, loading, saving, updateWorkspace } = useWorkspace();
  const [openedAt] = useState(() => Date.now());
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [itemFilter, setItemFilter] = useState<
    "all" | "events" | "publications"
  >("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | ScheduledPost["status"]
  >("all");
  const [platformFilter, setPlatformFilter] = useState<"all" | Platform>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [eventForm, setEventForm] = useState<EventForm>(() => emptyForm(""));
  const [formError, setFormError] = useState("");

  const timeZone = workspace.profile.timezone || "UTC";
  const todayKey = dateKey(new Date().toISOString(), timeZone);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const showEvents = itemFilter !== "publications";
  const showPosts = itemFilter !== "events";

  const datedPosts = useMemo(
    () =>
      showPosts
        ? workspace.posts.filter(post => {
            if (!postDate(post)) return false;
            if (statusFilter !== "all" && post.status !== statusFilter)
              return false;
            return (
              platformFilter === "all" ||
              post.platforms.includes(platformFilter)
            );
          })
        : [],
    [platformFilter, showPosts, statusFilter, workspace.posts]
  );

  const events = useMemo(
    () => (showEvents ? workspace.calendarEvents : []),
    [showEvents, workspace.calendarEvents]
  );

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const event of events) {
      map.set(event.date, [
        ...(map.get(event.date) || []),
        { type: "event", event },
      ]);
    }
    for (const post of datedPosts) {
      const value = postDate(post);
      if (!value) continue;
      const key = dateKey(value, timeZone);
      map.set(key, [...(map.get(key) || []), { type: "post", post }]);
    }
    for (const items of map.values()) {
      items.sort((left, right) =>
        itemSortKey(left).localeCompare(itemSortKey(right))
      );
    }
    return map;
  }, [datedPosts, events, timeZone]);

  const availablePlatforms = useMemo(
    () =>
      Array.from(
        new Set(workspace.posts.flatMap(post => post.platforms))
      ).sort(),
    [workspace.posts]
  );

  const selectedItems = selectedDate ? itemsByDate.get(selectedDate) || [] : [];
  const upcoming = useMemo(() => {
    const postItems: CalendarItem[] = datedPosts
      .filter(post => {
        const value = postDate(post);
        return value ? new Date(value).getTime() >= openedAt : false;
      })
      .map(post => ({ type: "post", post }));
    const eventItems: CalendarItem[] = events
      .filter(event => event.date >= todayKey)
      .map(event => ({ type: "event", event }));
    return [...eventItems, ...postItems]
      .sort((left, right) =>
        itemSortKey(left).localeCompare(itemSortKey(right))
      )
      .slice(0, 6);
  }, [datedPosts, events, openedAt, todayKey]);

  const getDateKey = (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const moveMonth = (direction: -1 | 1) => {
    setCurrentDate(new Date(year, month + direction, 1));
    setSelectedDate(null);
  };

  const openCreateEvent = (date = selectedDate || todayKey) => {
    setEditingEvent(null);
    setEventForm(emptyForm(date));
    setFormError("");
    setDialogOpen(true);
  };

  const openEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setEventForm({
      title: event.title,
      notes: event.notes,
      date: event.date,
      startTime: event.startTime || "09:00",
      endTime: event.endTime || "",
      kind: event.kind,
      allDay: !event.startTime,
    });
    setFormError("");
    setDialogOpen(true);
  };

  const saveEvent = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    const title = eventForm.title.trim();
    if (!title || !eventForm.date) {
      setFormError("Add a title and date.");
      return;
    }
    if (
      !eventForm.allDay &&
      eventForm.endTime &&
      eventForm.endTime <= eventForm.startTime
    ) {
      setFormError("End time must be after start time.");
      return;
    }

    const now = new Date().toISOString();
    const nextEvent: CalendarEvent = {
      id: editingEvent?.id || createId("event"),
      title,
      notes: eventForm.notes.trim(),
      date: eventForm.date,
      kind: eventForm.kind,
      ...(!eventForm.allDay
        ? {
            startTime: eventForm.startTime,
            ...(eventForm.endTime ? { endTime: eventForm.endTime } : {}),
          }
        : {}),
      createdAt: editingEvent?.createdAt || now,
      updatedAt: now,
    };

    try {
      await updateWorkspace(current => ({
        ...current,
        calendarEvents: editingEvent
          ? current.calendarEvents.map(event =>
              event.id === editingEvent.id ? nextEvent : event
            )
          : [...current.calendarEvents, nextEvent],
        activity: [
          {
            id: createId("activity"),
            type: "calendar" as const,
            label: editingEvent
              ? "Calendar event updated"
              : "Calendar event created",
            detail: nextEvent.title,
            createdAt: now,
          },
          ...current.activity,
        ].slice(0, 100),
      }));
      setSelectedDate(nextEvent.date);
      const eventDate = new Date(`${nextEvent.date}T12:00:00`);
      setCurrentDate(
        new Date(eventDate.getFullYear(), eventDate.getMonth(), 1)
      );
      setDialogOpen(false);
    } catch (cause) {
      setFormError(
        cause instanceof Error ? cause.message : "Could not save this event."
      );
    }
  };

  const deleteEvent = async (event: CalendarEvent) => {
    if (!window.confirm(`Delete “${event.title}”?`)) return;
    const now = new Date().toISOString();
    try {
      await updateWorkspace(current => ({
        ...current,
        calendarEvents: current.calendarEvents.filter(
          candidate => candidate.id !== event.id
        ),
        activity: [
          {
            id: createId("activity"),
            type: "calendar" as const,
            label: "Calendar event deleted",
            detail: event.title,
            createdAt: now,
          },
          ...current.activity,
        ].slice(0, 100),
      }));
    } catch (cause) {
      setFormError(
        cause instanceof Error ? cause.message : "Could not delete this event."
      );
    }
  };

  if (loading) {
    return <div className="min-h-[45vh] animate-pulse rounded-xl bg-surface" />;
  }

  const visibleItems = selectedDate ? selectedItems : upcoming;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mono-eyebrow mb-2 text-primary">Plan and publish</p>
          <h1 className="text-3xl font-semibold">Content Calendar</h1>
          <p className="mt-2 text-sm text-foreground/55">
            Your events and publication schedule, together in {timeZone}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/dashboard/publish">
              <Send /> Compose or schedule
            </Link>
          </Button>
          <Button
            type="button"
            onClick={() => openCreateEvent()}
            className="shadow-sm shadow-primary/20"
          >
            <CalendarPlus /> New event
          </Button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <select
          value={itemFilter}
          onChange={event =>
            setItemFilter(
              event.target.value as "all" | "events" | "publications"
            )
          }
          className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium"
          aria-label="Filter calendar items"
        >
          <option value="all">All calendar items</option>
          <option value="events">My events</option>
          <option value="publications">Publications</option>
        </select>
        {showPosts ? (
          <>
            <select
              value={statusFilter}
              onChange={event =>
                setStatusFilter(
                  event.target.value as "all" | ScheduledPost["status"]
                )
              }
              className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium"
              aria-label="Filter by publication status"
            >
              <option value="all">All dated posts</option>
              <option value="draft">Dated drafts</option>
              <option value="scheduled">Scheduled</option>
              <option value="publishing">Publishing</option>
              <option value="published">Published</option>
              <option value="failed">Failed</option>
            </select>
            <select
              value={platformFilter}
              onChange={event =>
                setPlatformFilter(event.target.value as "all" | Platform)
              }
              className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium"
              aria-label="Filter by platform"
            >
              <option value="all">All platforms</option>
              {availablePlatforms.map(platform => (
                <option key={platform} value={platform}>
                  {PLATFORM_META[platform].label}
                </option>
              ))}
            </select>
          </>
        ) : null}
        <span className="self-center text-xs text-foreground/40">
          Select any day to plan something there.
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-surface p-4 sm:p-6 lg:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {MONTHS[month]} {year}
            </h2>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                className="rounded-lg p-2 transition-transform hover:-translate-y-0.5 hover:bg-background"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setCurrentDate(
                    new Date(now.getFullYear(), now.getMonth(), 1)
                  );
                  setSelectedDate(todayKey);
                }}
                className="rounded-lg px-3 py-2 text-xs font-medium hover:bg-background"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                className="rounded-lg p-2 transition-transform hover:-translate-y-0.5 hover:bg-background"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {DAYS.map(day => (
              <div
                key={day}
                className="py-2 text-center text-[10px] uppercase tracking-wider text-foreground/40 sm:text-xs"
              >
                {day}
              </div>
            ))}
            {Array.from({ length: firstDay }, (_, index) => (
              <div key={`empty-${index}`} className="min-h-16 sm:min-h-24" />
            ))}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1;
              const key = getDateKey(day);
              const items = itemsByDate.get(key) || [];
              const isSelected = selectedDate === key;
              const isToday = todayKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDate(key)}
                  onDoubleClick={() => openCreateEvent(key)}
                  aria-label={`${MONTHS[month]} ${day}, ${year}: ${items.length} items`}
                  className={`group min-h-16 rounded-lg border p-1.5 text-left transition-all sm:min-h-24 sm:p-2 ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-sm"
                      : isToday
                        ? "border-primary/30 bg-primary/5"
                        : "border-transparent hover:-translate-y-0.5 hover:border-border hover:bg-background hover:shadow-sm"
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span
                      className={`text-xs font-medium sm:text-sm ${
                        isToday ? "text-primary" : ""
                      }`}
                    >
                      {day}
                    </span>
                    <Plus className="hidden h-3 w-3 text-primary opacity-0 transition-opacity group-hover:opacity-70 sm:block" />
                  </span>
                  {items.length ? (
                    <div className="mt-2 space-y-1">
                      {items.slice(0, 3).map(item => {
                        if (item.type === "event") {
                          const meta = EVENT_KIND_META[item.event.kind];
                          return (
                            <div
                              key={item.event.id}
                              className={`flex items-center gap-1 rounded border px-1.5 py-1 ${meta.accent}`}
                            >
                              <span
                                className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`}
                              />
                              <span className="hidden truncate text-[9px] text-foreground/70 sm:block">
                                {item.event.title}
                              </span>
                            </div>
                          );
                        }
                        return (
                          <div
                            key={item.post.id}
                            className="flex items-center gap-1 rounded bg-background/80 px-1.5 py-1"
                          >
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                PLATFORM_META[
                                  item.post.platforms[0] || "instagram"
                                ].dot
                              }`}
                            />
                            <span className="hidden truncate text-[9px] text-foreground/60 sm:block">
                              {postTitle(item.post)}
                            </span>
                          </div>
                        );
                      })}
                      {items.length > 3 ? (
                        <p className="text-[9px] text-foreground/40">
                          +{items.length - 3} more
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-center text-[11px] text-foreground/35">
            Tip: double-click a day to create an event immediately.
          </p>
        </section>

        <aside className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="border-b border-border bg-gradient-to-r from-primary/10 via-transparent to-accent/10 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-medium">
                  {selectedDate
                    ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
                        undefined,
                        { weekday: "long", month: "long", day: "numeric" }
                      )
                    : "Coming up"}
                </h2>
                {selectedDate ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => openCreateEvent(selectedDate)}
                  >
                    <Plus /> Add
                  </Button>
                ) : (
                  <CalendarDays className="h-4 w-4 text-primary" />
                )}
              </div>
            </div>
            <div className="p-5">
              {visibleItems.length ? (
                <div className="space-y-3">
                  {visibleItems.map(item =>
                    item.type === "event" ? (
                      <EventCard
                        key={item.event.id}
                        event={item.event}
                        showDate={!selectedDate}
                        saving={saving}
                        onEdit={openEditEvent}
                        onDelete={deleteEvent}
                      />
                    ) : (
                      <PostCard
                        key={item.post.id}
                        post={item.post}
                        timeZone={timeZone}
                        showDate={!selectedDate}
                      />
                    )
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-6 text-center">
                  <Sparkles className="mx-auto mb-2 h-5 w-5 text-primary/70" />
                  <p className="text-sm font-medium">
                    {selectedDate ? "This day is open" : "Nothing coming up"}
                  </p>
                  <p className="mt-1 text-xs text-foreground/45">
                    Add your own event or schedule a publication.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-4"
                    onClick={() => openCreateEvent()}
                  >
                    <CalendarPlus /> Add event
                  </Button>
                </div>
              )}
            </div>
          </div>
          <Link
            to="/dashboard/publish"
            className="block rounded-xl border border-border bg-surface p-4 text-sm font-medium text-primary transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-sm"
          >
            Open the publication queue
          </Link>
        </aside>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={saveEvent} className="space-y-5">
            <DialogHeader>
              <DialogTitle>
                {editingEvent ? "Edit event" : "Add calendar event"}
              </DialogTitle>
              <DialogDescription>
                Plan shoots, meetings, deadlines, tasks, or anything else around
                your content.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <label
                htmlFor="calendar-event-title"
                className="block space-y-1.5 text-sm font-medium"
              >
                Title
                <Input
                  id="calendar-event-title"
                  required
                  maxLength={160}
                  value={eventForm.title}
                  onChange={event =>
                    setEventForm(current => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Film product demo"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label
                  htmlFor="calendar-event-date"
                  className="block space-y-1.5 text-sm font-medium"
                >
                  Date
                  <Input
                    id="calendar-event-date"
                    type="date"
                    required
                    value={eventForm.date}
                    onChange={event =>
                      setEventForm(current => ({
                        ...current,
                        date: event.target.value,
                      }))
                    }
                  />
                </label>
                <label
                  htmlFor="calendar-event-kind"
                  className="block space-y-1.5 text-sm font-medium"
                >
                  Type
                  <select
                    id="calendar-event-kind"
                    value={eventForm.kind}
                    onChange={event =>
                      setEventForm(current => ({
                        ...current,
                        kind: event.target.value as CalendarEventKind,
                      }))
                    }
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {Object.entries(EVENT_KIND_META).map(([kind, meta]) => (
                      <option key={kind} value={kind}>
                        {meta.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={eventForm.allDay}
                  onChange={event =>
                    setEventForm(current => ({
                      ...current,
                      allDay: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                All-day event
              </label>

              {!eventForm.allDay ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label
                    htmlFor="calendar-event-start"
                    className="block space-y-1.5 text-sm font-medium"
                  >
                    Starts
                    <Input
                      id="calendar-event-start"
                      type="time"
                      required
                      value={eventForm.startTime}
                      onChange={event =>
                        setEventForm(current => ({
                          ...current,
                          startTime: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label
                    htmlFor="calendar-event-end"
                    className="block space-y-1.5 text-sm font-medium"
                  >
                    Ends (optional)
                    <Input
                      id="calendar-event-end"
                      type="time"
                      value={eventForm.endTime}
                      onChange={event =>
                        setEventForm(current => ({
                          ...current,
                          endTime: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
              ) : null}

              <label
                htmlFor="calendar-event-notes"
                className="block space-y-1.5 text-sm font-medium"
              >
                Notes (optional)
                <Textarea
                  id="calendar-event-notes"
                  maxLength={2000}
                  rows={3}
                  value={eventForm.notes}
                  onChange={event =>
                    setEventForm(current => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Location, brief, people involved…"
                />
              </label>

              {formError ? (
                <p role="alert" className="text-sm text-destructive">
                  {formError}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? "Saving…"
                  : editingEvent
                    ? "Save changes"
                    : "Add event"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EventCard({
  event,
  showDate,
  saving,
  onEdit,
  onDelete,
}: {
  event: CalendarEvent;
  showDate: boolean;
  saving: boolean;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
}) {
  const meta = EVENT_KIND_META[event.kind];
  return (
    <article
      className={`group rounded-lg border p-3 transition-transform hover:-translate-y-0.5 ${meta.accent}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-foreground/55">
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </p>
          <p className="mt-1.5 truncate text-sm font-medium">{event.title}</p>
        </div>
        <div className="flex shrink-0 opacity-70 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(event)}
            disabled={saving}
            className="rounded-md p-1.5 hover:bg-background/70 disabled:opacity-40"
            aria-label={`Edit ${event.title}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(event)}
            disabled={saving}
            className="rounded-md p-1.5 text-foreground/55 hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40"
            aria-label={`Delete ${event.title}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {event.notes ? (
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-foreground/50">
          {event.notes}
        </p>
      ) : null}
      <p className="mt-2 flex items-center gap-1 text-[10px] text-foreground/45">
        <Clock className="h-3 w-3" />
        {showDate ? `${event.date} · ` : ""}
        {event.startTime
          ? `${event.startTime}${event.endTime ? `–${event.endTime}` : ""}`
          : "All day"}
      </p>
    </article>
  );
}

function PostCard({
  post,
  timeZone,
  showDate,
}: {
  post: ScheduledPost;
  timeZone: string;
  showDate: boolean;
}) {
  const value = postDate(post);
  return (
    <article className="rounded-lg border border-border bg-background p-3 transition-transform hover:-translate-y-0.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {post.platforms.map(platform => (
          <span
            key={platform}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-foreground/55"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${PLATFORM_META[platform].dot}`}
            />
            {PLATFORM_META[platform].label}
          </span>
        ))}
      </div>
      <p className="mt-2 text-sm font-medium">{postTitle(post)}</p>
      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide">
        <span
          className={
            post.status === "failed"
              ? "text-red-500"
              : post.status === "published"
                ? "text-emerald-500"
                : "text-primary"
          }
        >
          {post.status}
        </span>
        {value ? (
          <span className="flex items-center gap-1 text-foreground/40">
            <Clock className="h-3 w-3" />
            {showDate ? `${dateKey(value, timeZone)} · ` : ""}
            {timeLabel(value, timeZone)}
          </span>
        ) : null}
      </div>
    </article>
  );
}
