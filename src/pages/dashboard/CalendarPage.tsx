import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Clock, Instagram, Youtube, Video } from "lucide-react";
import { motion } from "framer-motion";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const SCHEDULED_POSTS: Record<string, any[]> = {
  "2024-07-08": [{ title: "Summer Sale Launch", platform: "tiktok", time: "09:00", status: "scheduled" }],
  "2024-07-10": [{ title: "Product Tutorial", platform: "instagram", time: "14:00", status: "scheduled" }, { title: "Behind the Scenes", platform: "youtube", time: "18:00", status: "draft" }],
  "2024-07-12": [{ title: "Customer Testimonial", platform: "tiktok", time: "11:00", status: "scheduled" }],
  "2024-07-15": [{ title: "Weekly Tips", platform: "instagram", time: "10:00", status: "scheduled" }],
  "2024-07-18": [{ title: "New Arrival Showcase", platform: "youtube", time: "16:00", status: "draft" }],
};

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: "bg-black text-white",
  instagram: "bg-gradient-to-br from-purple-500 to-pink-500 text-white",
  youtube: "bg-red-600 text-white",
  x: "bg-slate-900 text-white",
  facebook: "bg-blue-600 text-white",
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date(2024, 6, 1)); // July 2024
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getDateKey = (day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="mono-eyebrow text-primary mb-2">Smart Publisher</p>
          <h1 className="text-3xl font-semibold">Content Calendar</h1>
        </div>
        <button className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors flex items-center gap-2">
          <Plus className="h-4 w-4" /> Schedule Post
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">{MONTHS[month]} {year}</h2>
            <div className="flex gap-1">
              <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-background"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-background"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-xs uppercase tracking-wider text-foreground/40 py-2">{d}</div>
            ))}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateKey = getDateKey(day);
              const posts = SCHEDULED_POSTS[dateKey] || [];
              const isSelected = selectedDate === dateKey;
              const isToday = day === 15; // Mock "today"

              return (
                <motion.button
                  key={day}
                  whileHover={{ scale: 1.05 }}
                  onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                  className={`aspect-square rounded-lg p-1.5 text-left transition-colors relative ${
                    isSelected ? "bg-primary/10 border border-primary/30" :
                    isToday ? "bg-primary/5 border border-primary/20" :
                    "hover:bg-background border border-transparent"
                  }`}
                >
                  <span className={`text-sm font-medium ${isToday ? "text-primary" : ""}`}>{day}</span>
                  {posts.length > 0 && (
                    <div className="flex gap-0.5 mt-1">
                      {posts.slice(0, 3).map((p, pi) => (
                        <div key={pi} className={`h-1.5 w-1.5 rounded-full ${p.platform === "tiktok" ? "bg-black" : p.platform === "instagram" ? "bg-pink-500" : "bg-red-500"}`} />
                      ))}
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {selectedDate ? (
            <div className="bg-surface border border-border rounded-xl p-5">
              <h3 className="font-medium mb-3">{new Date(selectedDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</h3>
              {SCHEDULED_POSTS[selectedDate]?.length ? (
                <div className="space-y-3">
                  {SCHEDULED_POSTS[selectedDate].map((post, i) => (
                    <div key={i} className="p-3 rounded-lg bg-background border border-border">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PLATFORM_COLORS[post.platform] || "bg-gray-500 text-white"}`}>
                          {post.platform}
                        </span>
                        <span className="text-xs text-foreground/50 flex items-center gap-1"><Clock className="h-3 w-3" />{post.time}</span>
                      </div>
                      <p className="text-sm font-medium">{post.title}</p>
                      <span className={`text-[10px] ${post.status === "scheduled" ? "text-emerald-500" : "text-amber-500"}`}>
                        {post.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-foreground/50">No posts scheduled</p>
              )}
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-xl p-5">
              <h3 className="font-medium mb-3">Upcoming</h3>
              <div className="space-y-3">
                {Object.entries(SCHEDULED_POSTS).slice(0, 3).map(([date, posts]) => (
                  <div key={date}>
                    <p className="text-xs text-foreground/40 mb-1">{new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                    {posts.map((post, i) => (
                      <div key={i} className="flex items-center gap-2 py-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${PLATFORM_COLORS[post.platform]}`}>{post.platform[0]}</span>
                        <span className="text-sm truncate">{post.title}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
