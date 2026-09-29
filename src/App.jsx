import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Home, Calendar as CalendarIcon, BarChart3, CheckSquare, StickyNote, Settings as SettingsIcon,
  Plus, X, Pencil, Trash2, Flame, Check, ChevronLeft, ChevronRight, Bell, BellOff, Sun, Moon,
  Droplet, BookOpen, Dumbbell, Heart, Brain, Coffee, Music, Code2, Utensils, Bike, Smile, Target,
  Leaf, Sparkles, Footprints, PenTool, Wind, Feather, Star, Clock, Pause, Play, Palette, User,
  TrendingUp, Award, AlertCircle, ChevronDown, MoreVertical, CalendarDays, ListChecks
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell
} from "recharts";

/* ---------------------------------- constants ---------------------------------- */

const THEMES = {
  lavender: { label: "Lavender Dream", accent: "#7C6FE0", accent2: "#B8A6F5", gradFrom: "#7C6FE0", gradTo: "#D9A9F0" },
  ocean:    { label: "Ocean",          accent: "#0E7C86", accent2: "#4FD1C5", gradFrom: "#0B5D6B", gradTo: "#4FD1C5" },
  sunset:   { label: "Sunset",         accent: "#E8622C", accent2: "#F7B733", gradFrom: "#E8622C", gradTo: "#F7B733" },
  forest:   { label: "Forest",         accent: "#2F7D5C", accent2: "#8FCB9B", gradFrom: "#1E5F45", gradTo: "#8FCB9B" },
  midnight: { label: "Midnight",       accent: "#5B6EE8", accent2: "#9AA6F3", gradFrom: "#1B1F3B", gradTo: "#5B6EE8" },
  minimal:  { label: "Minimal",        accent: "#3A3A3A", accent2: "#8A8A8A", gradFrom: "#3A3A3A", gradTo: "#8A8A8A" },
};

const ICONS = {
  Droplet, BookOpen, Dumbbell, Moon, Sun, Heart, Brain, Coffee, Pencil, Music, Code2, Utensils,
  Bike, Smile, Target, Flame, Leaf, Sparkles, Footprints, PenTool, Wind, Feather, Star, Clock,
};
const ICON_NAMES = Object.keys(ICONS);

const HABIT_COLORS = [
  "#7C6FE0", "#0E7C86", "#E8622C", "#2F7D5C", "#5B6EE8", "#D65C8B",
  "#C99A2E", "#3A9BDC", "#B24747", "#4F9D69",
];

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "calendar", label: "Calendar", icon: CalendarIcon },
  { id: "progress", label: "Progress", icon: BarChart3 },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

const QUOTES = [
  "Small steps every day lead to big changes.",
  "Discipline is choosing between what you want now and what you want most.",
  "You don't have to be extreme, just consistent.",
  "Progress, not perfection.",
  "Every habit you build is a vote for the person you want to become.",
];

const DEFAULT_SETTINGS = { theme: "lavender", mode: "light", notifHabits: true, notifTasks: true, name: "Madhu" };

/* ---------------------------------- helpers ---------------------------------- */

function fmt(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayStr() { return fmt(new Date()); }
function parseDate(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function addDays(dateStr, n) { const d = parseDate(dateStr); d.setDate(d.getDate() + n); return fmt(d); }
function niceDate(dateStr) {
  const d = parseDate(dateStr);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}
function niceDateShort(dateStr) {
  const d = parseDate(dateStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function isDue(habit, dateStr) {
  if (dateStr < habit.startDate) return false;
  if (habit.endDate && dateStr > habit.endDate) return false;
  const dow = parseDate(dateStr).getDay();
  if (habit.frequency === "weekdays") return dow >= 1 && dow <= 5;
  if (habit.frequency === "custom") return (habit.customDays || []).includes(dow);
  return true; // daily
}

function computeHabitStats(habit, completions, uptoDate) {
  const start = habit.startDate;
  const end = uptoDate < start ? start : uptoDate;
  let cursor = start, longest = 0, streak = 0, total = 0, due = 0;
  const dueDates = [];
  let guard = 0;
  while (cursor <= end && guard < 3660) {
    if (isDue(habit, cursor)) dueDates.push(cursor);
    cursor = addDays(cursor, 1);
    guard++;
  }
  dueDates.forEach((ds) => {
    const done = !!completions[ds]?.[habit.id];
    due++;
    if (done) { streak++; total++; if (streak > longest) longest = streak; }
    else streak = 0;
  });
  let current = 0;
  for (let i = dueDates.length - 1; i >= 0; i--) {
    if (completions[dueDates[i]]?.[habit.id]) current++; else break;
  }
  const pct = due ? Math.round((total / due) * 100) : 0;
  return { current, longest, total, pct, due };
}

const STORAGE_PREFIX = "habit-tracker:";

async function safeGet(key) {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
async function safeSet(key, value) {
  try { window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
}

/* ---------------------------------- small UI atoms ---------------------------------- */

function IconGlyph({ name, size = 18, style }) {
  const Cmp = ICONS[name] || Target;
  return <Cmp size={size} style={style} />;
}

function ProgressRing({ pct, size = 84, stroke = 9, color = "#7C6FE0", track = "#e9e7f5", children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (clamp(pct, 0, 100) / 100) * c;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div
      className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[80] px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium"
      style={{ background: toast.type === "error" ? "#DC2626" : "#1F2937", color: "#fff", animation: "toastIn .25s ease" }}
    >
      {toast.msg}
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onMouseDown={onClose}>
      <div
        className={`bg-[var(--surface)] w-full ${wide ? "md:max-w-2xl" : "md:max-w-md"} max-h-[80vh] overflow-y-auto rounded-3xl shadow-2xl p-6`}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ background: "var(--surface)", color: "var(--text)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-black/5 transition"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmDialog({ data, onCancel, onConfirm }) {
  if (!data) return null;
  return (
    <Modal title={data.title || "Are you sure?"} onClose={onCancel}>
      <p className="text-sm opacity-70 mb-5">{data.message}</p>
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-black/5 transition">Cancel</button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 rounded-xl text-sm font-medium text-white transition"
          style={{ background: "#DC2626" }}
        >
          {data.confirmLabel || "Delete"}
        </button>
      </div>
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-semibold mb-1.5 opacity-60 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition focus:ring-2";

/* ---------------------------------- Habit Form Modal ---------------------------------- */

function HabitFormModal({ initial, onClose, onSave, theme }) {
  const isEdit = !!initial?.id;
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [icon, setIcon] = useState(initial?.icon || "Target");
  const [color, setColor] = useState(initial?.color || HABIT_COLORS[0]);
  const [frequency, setFrequency] = useState(initial?.frequency || "daily");
  const [customDays, setCustomDays] = useState(initial?.customDays || [1, 2, 3, 4, 5]);
  const [startDate, setStartDate] = useState(initial?.startDate || todayStr());
  const [endDate, setEndDate] = useState(initial?.endDate || "");
  const [reminderEnabled, setReminderEnabled] = useState(initial?.reminderEnabled || false);
  const [reminderTime, setReminderTime] = useState(initial?.reminderTime || "08:00");
  const [error, setError] = useState("");

  const toggleDay = (d) => setCustomDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort());

  const submit = () => {
    if (!name.trim()) { setError("Give this habit a name."); return; }
    if (frequency === "custom" && customDays.length === 0) { setError("Pick at least one day."); return; }
    onSave({
      id: initial?.id || uid(),
      name: name.trim(), description: description.trim(), icon, color, frequency,
      customDays: frequency === "custom" ? customDays : [],
      startDate, endDate: endDate || null,
      reminderEnabled, reminderTime,
      paused: initial?.paused || false,
      createdAt: initial?.createdAt || Date.now(),
    });
  };

  return (
    <Modal title={isEdit ? "Edit habit" : "New habit"} onClose={onClose} wide>
      <Field label="Habit name">
        <input className={inputCls} style={{ borderColor: "var(--border)" }} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Drink water" />
      </Field>
      <Field label="Description">
        <textarea className={inputCls} style={{ borderColor: "var(--border)", minHeight: 60 }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date">
          <input type="date" className={inputCls} style={{ borderColor: "var(--border)" }} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="End date (optional)">
          <input type="date" className={inputCls} style={{ borderColor: "var(--border)" }} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </div>
      <Field label="Frequency">
        <div className="flex gap-2 flex-wrap">
          {[["daily", "Daily"], ["weekdays", "Weekdays"], ["custom", "Custom days"]].map(([v, l]) => (
            <button key={v} onClick={() => setFrequency(v)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border transition"
              style={frequency === v ? { background: color, borderColor: color, color: "#fff" } : { borderColor: "var(--border)", opacity: 0.7 }}>
              {l}
            </button>
          ))}
        </div>
        {frequency === "custom" && (
          <div className="flex gap-1.5 mt-2">
            {WEEKDAY_LABELS.map((d, i) => (
              <button key={i} onClick={() => toggleDay(i)}
                className="w-8 h-8 rounded-full text-xs font-bold border transition"
                style={customDays.includes(i) ? { background: color, borderColor: color, color: "#fff" } : { borderColor: "var(--border)", opacity: 0.6 }}>
                {d}
              </button>
            ))}
          </div>
        )}
      </Field>
      <Field label="Icon">
        <div className="flex flex-wrap gap-2">
          {ICON_NAMES.map((n) => (
            <button key={n} onClick={() => setIcon(n)} type="button"
              className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center border transition"
              style={icon === n ? { background: color + "22", borderColor: color, color } : { borderColor: "var(--border)", opacity: 0.6 }}>
              <IconGlyph name={n} size={15} />
            </button>
          ))}
        </div>
      </Field>
      <Field label="Color">
        <div className="flex gap-2 flex-wrap">
          {HABIT_COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)}
              className="w-7 h-7 rounded-full border-2 transition"
              style={{ background: c, borderColor: color === c ? "var(--text)" : "transparent" }} />
          ))}
        </div>
      </Field>
      <Field label="Reminder">
        <div className="flex items-center gap-3">
          <button onClick={() => setReminderEnabled((v) => !v)}
            className="w-11 h-6 rounded-full relative transition"
            style={{ background: reminderEnabled ? color : "var(--border)" }}>
            <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: reminderEnabled ? 22 : 2 }} />
          </button>
          <input type="time" disabled={!reminderEnabled} className={inputCls + " w-32 disabled:opacity-40"} style={{ borderColor: "var(--border)" }} value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} />
        </div>
      </Field>
      {error && <p className="text-xs mb-2" style={{ color: "#DC2626" }}>{error}</p>}
      <div className="flex justify-end gap-3 mt-4">
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-black/5 transition">Cancel</button>
        <button onClick={submit} className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition" style={{ background: `linear-gradient(135deg, ${theme.gradFrom}, ${theme.gradTo})` }}>
          {isEdit ? "Save changes" : "Create habit"}
        </button>
      </div>
    </Modal>
  );
}

/* ---------------------------------- Task / Note Modals ---------------------------------- */

function TaskModal({ initial, onClose, onSave, theme }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [priority, setPriority] = useState(initial?.priority || "medium");
  const [dueDate, setDueDate] = useState(initial?.dueDate || "");
  const [error, setError] = useState("");
  const submit = () => {
    if (!title.trim()) { setError("Give this task a title."); return; }
    onSave({
      id: initial?.id || uid(), title: title.trim(), priority, dueDate: dueDate || null,
      completed: initial?.completed || false, createdAt: initial?.createdAt || Date.now(),
    });
  };
  return (
    <Modal title={initial?.id ? "Edit task" : "New task"} onClose={onClose}>
      <Field label="Task">
        <input className={inputCls} style={{ borderColor: "var(--border)" }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Complete DSA practice" />
      </Field>
      <Field label="Priority">
        <div className="flex gap-2">
          {[["low", "Low", "#3A9BDC"], ["medium", "Medium", "#C99A2E"], ["high", "High", "#DC2626"]].map(([v, l, c]) => (
            <button key={v} onClick={() => setPriority(v)} className="px-3 py-1.5 rounded-full text-xs font-semibold border transition"
              style={priority === v ? { background: c, borderColor: c, color: "#fff" } : { borderColor: "var(--border)", opacity: 0.7 }}>{l}</button>
          ))}
        </div>
      </Field>
      <Field label="Due date (optional)">
        <input type="date" className={inputCls} style={{ borderColor: "var(--border)" }} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </Field>
      {error && <p className="text-xs mb-2" style={{ color: "#DC2626" }}>{error}</p>}
      <div className="flex justify-end gap-3 mt-4">
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-black/5 transition">Cancel</button>
        <button onClick={submit} className="px-5 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: `linear-gradient(135deg, ${theme.gradFrom}, ${theme.gradTo})` }}>Save</button>
      </div>
    </Modal>
  );
}

function NoteModal({ initial, onClose, onSave, theme }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [body, setBody] = useState(initial?.body || "");
  const [error, setError] = useState("");
  const submit = () => {
    if (!title.trim() && !body.trim()) { setError("Write something first."); return; }
    onSave({ id: initial?.id || uid(), title: title.trim() || "Untitled note", body: body.trim(), createdAt: initial?.createdAt || Date.now(), updatedAt: Date.now() });
  };
  return (
    <Modal title={initial?.id ? "Edit note" : "New note"} onClose={onClose}>
      <Field label="Title">
        <input className={inputCls} style={{ borderColor: "var(--border)" }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title" />
      </Field>
      <Field label="Note">
        <textarea className={inputCls} style={{ borderColor: "var(--border)", minHeight: 140 }} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your thoughts..." />
      </Field>
      {error && <p className="text-xs mb-2" style={{ color: "#DC2626" }}>{error}</p>}
      <div className="flex justify-end gap-3 mt-4">
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-black/5 transition">Cancel</button>
        <button onClick={submit} className="px-5 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: `linear-gradient(135deg, ${theme.gradFrom}, ${theme.gradTo})` }}>Save</button>
      </div>
    </Modal>
  );
}

/* ---------------------------------- Day Detail Modal ---------------------------------- */

function DayDetailModal({ dateStr, habits, completions, onClose, onToggle, theme }) {
  const dueHabits = habits.filter((h) => !h.paused && isDue(h, dateStr));
  return (
    <Modal title={niceDate(dateStr)} onClose={onClose}>
      {dueHabits.length === 0 ? (
        <p className="text-sm opacity-60 py-6 text-center">No habits were scheduled for this day.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {dueHabits.map((h) => {
            const done = !!completions[dateStr]?.[h.id];
            return (
              <button key={h.id} onClick={() => onToggle(h.id, dateStr)}
                className="flex items-center gap-3 p-3 rounded-2xl border transition text-left"
                style={{ borderColor: done ? h.color : "var(--border)", background: done ? h.color + "14" : "transparent" }}>
                <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: h.color + "22", color: h.color }}>
                  <IconGlyph name={h.icon} size={16} />
                </span>
                <span className="flex-1 text-sm font-medium">{h.name}</span>
                <span className="w-7 h-7 rounded-full border-2 flex items-center justify-center transition" style={{ borderColor: done ? h.color : "var(--border)", background: done ? h.color : "transparent" }}>
                  {done && <Check size={14} color="#fff" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

/* ---------------------------------- Dashboard ---------------------------------- */

function SummaryCard({ label, value, icon: Icon, accent }) {
  return (
    <div className="rounded-2xl p-4 flex items-center gap-3 shadow-sm border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: accent + "1c", color: accent }}>
        <Icon size={18} />
      </div>
      <div>
        <div className="text-xl font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>{value}</div>
        <div className="text-[11px] opacity-60 font-medium uppercase tracking-wide">{label}</div>
      </div>
    </div>
  );
}

function HabitRow({ habit, done, stats, onToggle, onEdit, onDelete, onPause }) {
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-2xl border transition group" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: habit.color + "22", color: habit.color }}>
        <IconGlyph name={habit.icon} size={18} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold truncate">{habit.name}</span>
          {stats.current > 0 && (
            <span className="text-[11px] font-bold flex items-center gap-0.5" style={{ color: "#E8622C" }}>
              <Flame size={12} fill="#E8622C" /> {stats.current}
            </span>
          )}
        </div>
        <div className="h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: "var(--track)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${stats.pct}%`, background: habit.color }} />
        </div>
      </div>
      <span className="text-xs font-semibold opacity-50 w-9 text-right shrink-0">{stats.pct}%</span>
      <button onClick={() => onToggle(habit.id)}
        className="w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0 transition"
        style={{ borderColor: done ? habit.color : "var(--border)", background: done ? habit.color : "transparent" }}>
        {done && <Check size={16} color="#fff" />}
      </button>
      <div className="flex items-center gap-1 shrink-0 opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button onClick={() => onPause(habit)} className="p-1.5 rounded-lg hover:bg-black/5" title={habit.paused ? "Resume" : "Pause"}>
          {habit.paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
        <button onClick={() => onEdit(habit)} className="p-1.5 rounded-lg hover:bg-black/5"><Pencil size={14} /></button>
        <button onClick={() => onDelete(habit)} className="p-1.5 rounded-lg hover:bg-black/5" style={{ color: "#DC2626" }}><Trash2 size={14} /></button>
      </div>
    </div>
  );
}

function Dashboard({ habits, completions, onToggle, onNewHabit, onEdit, onDelete, onPause, theme, settings, tasks, badges }) {
  const today = todayStr();
  const active = habits.filter((h) => !h.paused);
  const dueToday = active.filter((h) => isDue(h, today));
  const completedToday = dueToday.filter((h) => completions[today]?.[h.id]).length;
  const statsMap = useMemo(() => {
    const m = {};
    habits.forEach((h) => { m[h.id] = computeHabitStats(h, completions, today); });
    return m;
  }, [habits, completions]);
  const overallPct = dueToday.length ? Math.round((completedToday / dueToday.length) * 100) : 0;
  const bestStreak = active.reduce((m, h) => Math.max(m, statsMap[h.id]?.current || 0), 0);
  const tasksRemaining = tasks.filter((t) => !t.completed).length;
  const quote = useMemo(() => QUOTES[new Date().getDate() % QUOTES.length], []);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl p-6 md:p-8 text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${theme.gradFrom}, ${theme.gradTo})` }}>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6 justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest opacity-80 font-semibold mb-1">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
            <h2 className="text-2xl md:text-3xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>Welcome back, {settings.name}</h2>
            <p className="text-sm opacity-90 italic max-w-md">&ldquo;{quote}&rdquo;</p>
          </div>
          <ProgressRing pct={overallPct} size={100} stroke={9} color="#fff" track="rgba(255,255,255,0.25)">
            <div className="text-center">
              <div className="text-xl font-bold">{overallPct}%</div>
              <div className="text-[10px] opacity-80">today</div>
            </div>
          </ProgressRing>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="Total habits" value={active.length} icon={Target} accent={theme.accent} />
        <SummaryCard label="Done today" value={`${completedToday}/${dueToday.length}`} icon={Check} accent="#2F7D5C" />
        <SummaryCard label="Best streak" value={bestStreak} icon={Flame} accent="#E8622C" />
        <SummaryCard label="Completion" value={`${overallPct}%`} icon={TrendingUp} accent={theme.accent2} />
        <SummaryCard label="Tasks left" value={tasksRemaining} icon={ListChecks} accent="#C99A2E" />
      </div>

      {badges.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {badges.map((b) => (
            <div key={b.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: theme.accent + "16", color: theme.accent }}>
              <Award size={13} /> {b.label}
            </div>
          ))}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>Today&rsquo;s Progress</h3>
          <button onClick={onNewHabit} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-white transition" style={{ background: theme.accent }}>
            <Plus size={14} /> Add habit
          </button>
        </div>
        {active.length === 0 ? (
          <div className="text-center py-14 rounded-2xl border-2 border-dashed" style={{ borderColor: "var(--border)" }}>
            <Sparkles className="mx-auto mb-2 opacity-40" size={28} />
            <p className="text-sm opacity-60 mb-3">No habits yet — start your first one today.</p>
            <button onClick={onNewHabit} className="text-sm font-semibold px-4 py-2 rounded-xl text-white" style={{ background: theme.accent }}>Create a habit</button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {dueToday.length === 0 && <p className="text-sm opacity-50 py-4">Nothing scheduled for today. Enjoy the rest!</p>}
            {dueToday.map((h) => (
              <HabitRow key={h.id} habit={h} done={!!completions[today]?.[h.id]} stats={statsMap[h.id]}
                onToggle={() => onToggle(h.id, today)} onEdit={onEdit} onDelete={onDelete} onPause={onPause} />
            ))}
            {active.filter((h) => !isDue(h, today)).length > 0 && (
              <>
                <p className="text-xs opacity-40 font-semibold uppercase tracking-wide mt-3 mb-1">Not scheduled today</p>
                {active.filter((h) => !isDue(h, today)).map((h) => (
                  <div key={h.id} className="flex items-center gap-3 p-3 rounded-2xl border opacity-50" style={{ borderColor: "var(--border)" }}>
                    <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: h.color + "22", color: h.color }}><IconGlyph name={h.icon} size={15} /></span>
                    <span className="text-sm font-medium flex-1">{h.name}</span>
                    <button onClick={() => onEdit(h)} className="p-1.5"><Pencil size={13} /></button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- Calendar View ---------------------------------- */

function CalendarView({ habits, completions, month, setMonth, onToggle, onDayClick, dayCount, setDayCount, theme }) {
  const year = month.getFullYear(), mIdx = month.getMonth();
  const nDays = daysInMonth(year, mIdx);
  const firstDow = new Date(year, mIdx, 1).getDay();
  const today = todayStr();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= nDays; d++) cells.push(d);

  const dayStatus = (dateStr) => {
    const due = habits.filter((h) => !h.paused && isDue(h, dateStr));
    if (due.length === 0) return dateStr > today ? "future" : "none";
    const done = due.filter((h) => completions[dateStr]?.[h.id]).length;
    if (dateStr > today) return "future";
    if (done === due.length) return "complete";
    if (done > 0) return "partial";
    return "missed";
  };

  const statusStyle = {
    complete: { background: theme.accent, color: "#fff" },
    partial: { background: theme.accent + "35", color: "var(--text)" },
    missed: { background: "#fde3e3", color: "#B23A3A" },
    future: { background: "transparent", color: "var(--text)", opacity: 0.35 },
    none: { background: "transparent", color: "var(--text)", opacity: 0.35 },
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setMonth(new Date(year, mIdx - 1, 1))} className="p-2 rounded-xl border" style={{ borderColor: "var(--border)" }}><ChevronLeft size={16} /></button>
          <h3 className="text-base font-semibold w-40 text-center" style={{ fontFamily: "var(--font-display)" }}>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h3>
          <button onClick={() => setMonth(new Date(year, mIdx + 1, 1))} className="p-2 rounded-xl border" style={{ borderColor: "var(--border)" }}><ChevronRight size={16} /></button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(new Date())} className="text-xs font-semibold px-3 py-2 rounded-xl border" style={{ borderColor: "var(--border)" }}>Today</button>
          <select value={dayCount} onChange={(e) => setDayCount(Number(e.target.value))} className="text-xs font-semibold px-3 py-2 rounded-xl border bg-transparent" style={{ borderColor: "var(--border)" }}>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={0}>Full month</option>
          </select>
        </div>
      </div>

      <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="grid grid-cols-7 gap-1.5 mb-2">
          {WEEKDAY_LABELS.map((d, i) => <div key={i} className="text-center text-[11px] font-bold opacity-40">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const dateStr = fmt(new Date(year, mIdx, d));
            const status = dayStatus(dateStr);
            const inWindow = dayCount === 0 ? true : dateStr > addDays(today, -dayCount) && dateStr <= today;
            return (
              <button key={i} onClick={() => onDayClick(dateStr)}
                className="aspect-square rounded-xl text-xs font-semibold flex items-center justify-center transition hover:scale-105"
                style={{ ...statusStyle[status], opacity: inWindow ? (statusStyle[status].opacity ?? 1) : 0.25, outline: dateStr === today ? `2px solid ${theme.accent}` : "none" }}>
                {d}
              </button>
            );
          })}
        </div>
        <div className="flex gap-4 mt-4 flex-wrap text-[11px] opacity-60">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: theme.accent }} /> Complete</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: theme.accent + "35" }} /> Partial</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: "#fde3e3" }} /> Missed</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border" style={{ borderColor: "var(--border)" }} /> Future</span>
        </div>
      </div>

      <p className="text-xs opacity-50 text-center">Click any day to view or edit that day&rsquo;s habit completions.</p>
    </div>
  );
}

/* ---------------------------------- Progress / Analytics View ---------------------------------- */

function ProgressView({ habits, completions, theme, mode }) {
  const [habitFilter, setHabitFilter] = useState("all");
  const [rangeFilter, setRangeFilter] = useState("month");
  const today = todayStr();

  const relevantHabits = habitFilter === "all" ? habits : habits.filter((h) => h.id === habitFilter);

  const rangeDays = rangeFilter === "week" ? 7 : rangeFilter === "month" ? 30 : 90;
  const startDate = addDays(today, -(rangeDays - 1));

  const weeklyData = useMemo(() => {
    const arr = [];
    for (let i = 6; i >= 0; i--) {
      const ds = addDays(today, -i);
      const due = relevantHabits.filter((h) => !h.paused && isDue(h, ds));
      const done = due.filter((h) => completions[ds]?.[h.id]).length;
      arr.push({ day: niceDateShort(ds), pct: due.length ? Math.round((done / due.length) * 100) : 0 });
    }
    return arr;
  }, [relevantHabits, completions]);

  const monthlyData = useMemo(() => {
    const arr = [];
    let cursor = startDate;
    let guard = 0;
    while (cursor <= today && guard < 100) {
      const due = relevantHabits.filter((h) => !h.paused && isDue(h, cursor));
      const done = due.filter((h) => completions[cursor]?.[h.id]).length;
      arr.push({ day: niceDateShort(cursor), pct: due.length ? Math.round((done / due.length) * 100) : null });
      cursor = addDays(cursor, 1);
      guard++;
    }
    return arr;
  }, [relevantHabits, completions, startDate]);

  const habitWise = useMemo(() => habits.map((h) => ({ name: h.name, pct: computeHabitStats(h, completions, today).pct, color: h.color })), [habits, completions]);

  let totalCompleted = 0, totalDue = 0, missedDays = 0;
  const rangeDates = [];
  { let cursor = startDate; while (cursor <= today) { rangeDates.push(cursor); cursor = addDays(cursor, 1); } }
  rangeDates.forEach((ds) => {
    const due = relevantHabits.filter((h) => !h.paused && isDue(h, ds));
    const done = due.filter((h) => completions[ds]?.[h.id]).length;
    totalDue += due.length; totalCompleted += done;
    if (due.length > 0 && done < due.length) missedDays++;
  });
  const overallPct = totalDue ? Math.round((totalCompleted / totalDue) * 100) : 0;

  const bestCurrent = habits.reduce((m, h) => Math.max(m, computeHabitStats(h, completions, today).current), 0);
  const bestLongest = habits.reduce((m, h) => Math.max(m, computeHabitStats(h, completions, today).longest), 0);

  const gridColor = mode === "dark" ? "#3a3a44" : "#eee";
  const textColor = mode === "dark" ? "#ccc" : "#666";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>Progress Analytics</h3>
        <div className="flex gap-2">
          <select value={habitFilter} onChange={(e) => setHabitFilter(e.target.value)} className="text-xs font-semibold px-3 py-2 rounded-xl border bg-transparent" style={{ borderColor: "var(--border)" }}>
            <option value="all">All habits</option>
            {habits.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <select value={rangeFilter} onChange={(e) => setRangeFilter(e.target.value)} className="text-xs font-semibold px-3 py-2 rounded-xl border bg-transparent" style={{ borderColor: "var(--border)" }}>
            <option value="week">This week</option>
            <option value="month">Last 30 days</option>
            <option value="range">Last 90 days</option>
          </select>
        </div>
      </div>

      <div className="rounded-2xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${theme.gradFrom}, ${theme.gradTo})` }}>
        <p className="text-xs uppercase tracking-wide opacity-80 font-semibold mb-1">{new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })} Progress</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
          <div><div className="text-2xl font-bold">{overallPct}%</div><div className="text-[11px] opacity-80">overall completion</div></div>
          <div><div className="text-2xl font-bold">{totalCompleted}</div><div className="text-[11px] opacity-80">completed days</div></div>
          <div><div className="text-2xl font-bold">{bestCurrent}</div><div className="text-[11px] opacity-80">current streak</div></div>
          <div><div className="text-2xl font-bold">{bestLongest}</div><div className="text-[11px] opacity-80">longest streak</div></div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h4 className="text-sm font-semibold mb-3">Weekly completion</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: "none" }} />
              <Bar dataKey="pct" radius={[6, 6, 0, 0]} fill={theme.accent} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h4 className="text-sm font-semibold mb-3">Trend over time</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: textColor }} axisLine={false} tickLine={false} interval={Math.floor(monthlyData.length / 6)} />
              <YAxis tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: "none" }} />
              <Line type="monotone" dataKey="pct" stroke={theme.accent2} strokeWidth={2.5} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h4 className="text-sm font-semibold mb-3">Habit-wise completion</h4>
          {habitWise.length === 0 ? <p className="text-xs opacity-50">No habits to show yet.</p> : (
            <div className="space-y-3">
              {habitWise.map((h) => (
                <div key={h.name}>
                  <div className="flex justify-between text-xs font-medium mb-1"><span>{h.name}</span><span className="opacity-60">{h.pct}%</span></div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--track)" }}>
                    <div className="h-full rounded-full" style={{ width: `${h.pct}%`, background: h.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-2xl border p-4 flex flex-col items-center justify-center" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h4 className="text-sm font-semibold mb-3 self-start">Overall completion</h4>
          <ProgressRing pct={overallPct} size={140} stroke={14} color={theme.accent} track="var(--track)">
            <div className="text-center">
              <div className="text-2xl font-bold">{overallPct}%</div>
              <div className="text-[11px] opacity-60">{missedDays} missed days</div>
            </div>
          </ProgressRing>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Tasks View ---------------------------------- */

function TasksView({ tasks, onNew, onEdit, onDelete, onToggle, theme }) {
  const today = todayStr();
  const overdue = tasks.filter((t) => !t.completed && t.dueDate && t.dueDate < today);
  const upcoming = tasks.filter((t) => !t.completed && (!t.dueDate || t.dueDate >= today));
  const done = tasks.filter((t) => t.completed);
  const prioColor = { high: "#DC2626", medium: "#C99A2E", low: "#3A9BDC" };

  const Row = ({ t }) => (
    <div className="flex items-center gap-3 p-3 rounded-2xl border group" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <button onClick={() => onToggle(t.id)} className="w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition"
        style={{ borderColor: t.completed ? theme.accent : "var(--border)", background: t.completed ? theme.accent : "transparent" }}>
        {t.completed && <Check size={13} color="#fff" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium truncate ${t.completed ? "line-through opacity-40" : ""}`}>{t.title}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: prioColor[t.priority] }}>{t.priority}</span>
          {t.dueDate && <span className="text-[11px] opacity-50">· {niceDateShort(t.dueDate)}</span>}
        </div>
      </div>
      <div className="flex gap-0.5 shrink-0 opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(t)} className="p-1.5 rounded-lg hover:bg-black/5"><Pencil size={13} /></button>
        <button onClick={() => onDelete(t)} className="p-1.5 rounded-lg hover:bg-black/5" style={{ color: "#DC2626" }}><Trash2 size={13} /></button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>Notes & Tasks</h3>
        <button onClick={onNew} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-white" style={{ background: theme.accent }}><Plus size={14} /> Add task</button>
      </div>
      {tasks.length === 0 && (
        <div className="text-center py-14 rounded-2xl border-2 border-dashed" style={{ borderColor: "var(--border)" }}>
          <ListChecks className="mx-auto mb-2 opacity-40" size={28} />
          <p className="text-sm opacity-60">No tasks yet. Add one to get organized.</p>
        </div>
      )}
      {overdue.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: "#DC2626" }}><AlertCircle size={13} /> Overdue</h4>
          <div className="flex flex-col gap-2">{overdue.map((t) => <Row key={t.id} t={t} />)}</div>
        </div>
      )}
      {upcoming.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide mb-2 opacity-50">Upcoming</h4>
          <div className="flex flex-col gap-2">{upcoming.map((t) => <Row key={t.id} t={t} />)}</div>
        </div>
      )}
      {done.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide mb-2 opacity-50">Completed</h4>
          <div className="flex flex-col gap-2">{done.map((t) => <Row key={t.id} t={t} />)}</div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- Notes View ---------------------------------- */

function NotesView({ notes, onNew, onEdit, onDelete, theme }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>Notes</h3>
        <button onClick={onNew} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-white" style={{ background: theme.accent }}><Plus size={14} /> Add note</button>
      </div>
      {notes.length === 0 ? (
        <div className="text-center py-14 rounded-2xl border-2 border-dashed" style={{ borderColor: "var(--border)" }}>
          <StickyNote className="mx-auto mb-2 opacity-40" size={28} />
          <p className="text-sm opacity-60">No notes yet. Capture a thought.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {notes.sort((a, b) => b.updatedAt - a.updatedAt).map((n) => (
            <div key={n.id} className="rounded-2xl border p-4 group relative" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div className="flex justify-between items-start mb-1.5">
                <h4 className="text-sm font-semibold pr-8">{n.title}</h4>
                <div className="flex gap-1 absolute top-3 right-3 opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onEdit(n)} className="p-1 rounded hover:bg-black/5"><Pencil size={13} /></button>
                  <button onClick={() => onDelete(n)} className="p-1 rounded hover:bg-black/5" style={{ color: "#DC2626" }}><Trash2 size={13} /></button>
                </div>
              </div>
              <p className="text-xs opacity-70 whitespace-pre-wrap line-clamp-5">{n.body}</p>
              <p className="text-[10px] opacity-40 mt-2">{new Date(n.updatedAt).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- Settings View ---------------------------------- */

function SettingsView({ settings, setSettings, theme }) {
  const [notifStatus, setNotifStatus] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");

  const requestNotif = async () => {
    if (typeof Notification === "undefined") { setNotifStatus("unsupported"); return; }
    const perm = await Notification.requestPermission();
    setNotifStatus(perm);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h3 className="text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>Settings</h3>

      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><User size={15} /> Profile</h4>
        <Field label="Display name">
          <input className={inputCls} style={{ borderColor: "var(--border)" }} value={settings.name} onChange={(e) => setSettings((s) => ({ ...s, name: e.target.value }))} />
        </Field>
      </div>

      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Palette size={15} /> Appearance</h4>
        <Field label="Mode">
          <div className="flex gap-2">
            <button onClick={() => setSettings((s) => ({ ...s, mode: "light" }))} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition"
              style={settings.mode === "light" ? { background: theme.accent, borderColor: theme.accent, color: "#fff" } : { borderColor: "var(--border)" }}>
              <Sun size={15} /> Light
            </button>
            <button onClick={() => setSettings((s) => ({ ...s, mode: "dark" }))} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition"
              style={settings.mode === "dark" ? { background: theme.accent, borderColor: theme.accent, color: "#fff" } : { borderColor: "var(--border)" }}>
              <Moon size={15} /> Dark
            </button>
          </div>
        </Field>
        <Field label="Theme palette">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {Object.entries(THEMES).map(([key, t]) => (
              <button key={key} onClick={() => setSettings((s) => ({ ...s, theme: key }))}
                className="rounded-xl p-3 border-2 text-left transition"
                style={{ borderColor: settings.theme === key ? t.accent : "var(--border)" }}>
                <div className="h-8 rounded-lg mb-2" style={{ background: `linear-gradient(135deg, ${t.gradFrom}, ${t.gradTo})` }} />
                <span className="text-xs font-semibold">{t.label}</span>
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Bell size={15} /> Reminders</h4>
        <div className="flex items-center justify-between py-2">
          <div>
            <div className="text-sm font-medium">Browser notifications</div>
            <div className="text-xs opacity-50">
              {notifStatus === "granted" ? "Enabled — you'll get reminders as browser notifications." :
                notifStatus === "denied" ? "Blocked. Enable notifications for this site in your browser settings." :
                notifStatus === "unsupported" ? "Not supported in this browser — in-app reminders will show instead." :
                "Enable to receive habit and task reminders as browser notifications."}
            </div>
          </div>
          {notifStatus !== "granted" && notifStatus !== "unsupported" && (
            <button onClick={requestNotif} className="text-xs font-semibold px-3 py-2 rounded-xl text-white shrink-0" style={{ background: theme.accent }}>Enable</button>
          )}
          {notifStatus === "granted" && <Check size={18} style={{ color: theme.accent }} />}
        </div>
        <div className="flex items-center justify-between py-2 border-t mt-1 pt-3" style={{ borderColor: "var(--border)" }}>
          <span className="text-sm font-medium">Habit reminders</span>
          <button onClick={() => setSettings((s) => ({ ...s, notifHabits: !s.notifHabits }))} className="w-11 h-6 rounded-full relative transition" style={{ background: settings.notifHabits ? theme.accent : "var(--border)" }}>
            <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: settings.notifHabits ? 22 : 2 }} />
          </button>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-sm font-medium">Task reminders</span>
          <button onClick={() => setSettings((s) => ({ ...s, notifTasks: !s.notifTasks }))} className="w-11 h-6 rounded-full relative transition" style={{ background: settings.notifTasks ? theme.accent : "var(--border)" }}>
            <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: settings.notifTasks ? 22 : 2 }} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- App Shell ---------------------------------- */

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [habits, setHabits] = useState([]);
  const [completions, setCompletions] = useState({});
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [view, setView] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [habitModal, setHabitModal] = useState(null);
  const [taskModal, setTaskModal] = useState(null);
  const [noteModal, setNoteModal] = useState(null);
  const [confirmData, setConfirmData] = useState(null);
  const [dayModalDate, setDayModalDate] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [dayCount, setDayCount] = useState(30);
  const notifiedRef = useRef(new Set());
  const toastTimer = useRef(null);

  const theme = THEMES[settings.theme] || THEMES.lavender;
  const mode = settings.mode;

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  // load all data
  useEffect(() => {
    (async () => {
      const [h, c, t, n, s] = await Promise.all([
        safeGet("habits"), safeGet("completions"), safeGet("tasks"), safeGet("notes"), safeGet("settings"),
      ]);
      if (h) setHabits(h);
      if (c) setCompletions(c);
      if (t) setTasks(t);
      if (n) setNotes(n);
      if (s) setSettings({ ...DEFAULT_SETTINGS, ...s });
      setLoaded(true);
    })();
  }, []);

  useEffect(() => { if (loaded) safeSet("habits", habits); }, [habits, loaded]);
  useEffect(() => { if (loaded) safeSet("completions", completions); }, [completions, loaded]);
  useEffect(() => { if (loaded) safeSet("tasks", tasks); }, [tasks, loaded]);
  useEffect(() => { if (loaded) safeSet("notes", notes); }, [notes, loaded]);
  useEffect(() => { if (loaded) safeSet("settings", settings); }, [settings, loaded]);

  // reminder polling
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const ds = todayStr();
      if (settings.notifHabits) {
        habits.forEach((h) => {
          if (h.paused || !h.reminderEnabled || h.reminderTime !== hm) return;
          if (!isDue(h, ds)) return;
          if (completions[ds]?.[h.id]) return;
          const key = `habit-${h.id}-${ds}-${hm}`;
          if (notifiedRef.current.has(key)) return;
          notifiedRef.current.add(key);
          fireReminder(`Habit reminder`, `Time for: ${h.name}`, showToast);
        });
      }
      if (settings.notifTasks) {
        tasks.forEach((t) => {
          if (t.completed || !t.dueDate) return;
          if (t.dueDate !== ds) return;
          const key = `task-${t.id}-${ds}`;
          if (hm !== "09:00" || notifiedRef.current.has(key)) return;
          notifiedRef.current.add(key);
          fireReminder(`Task due today`, t.title, showToast);
        });
      }
    }, 20000);
    return () => clearInterval(interval);
  }, [habits, tasks, completions, settings, showToast]);

  function fireReminder(title, body, toastFn) {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try { new Notification(title, { body }); return; } catch (e) { /* fallthrough */ }
    }
    toastFn(`${title}: ${body}`);
  }

  const toggleCompletion = useCallback((habitId, dateStr) => {
    setCompletions((prev) => {
      const day = { ...(prev[dateStr] || {}) };
      day[habitId] = !day[habitId];
      return { ...prev, [dateStr]: day };
    });
  }, []);

  const saveHabit = (habit) => {
    setHabits((prev) => {
      const exists = prev.some((h) => h.id === habit.id);
      return exists ? prev.map((h) => (h.id === habit.id ? habit : h)) : [...prev, habit];
    });
    setHabitModal(null);
    showToast(habitModal === "new" || !habitModal?.id ? "Habit created" : "Habit updated");
  };
  const deleteHabit = (habit) => {
    setHabits((prev) => prev.filter((h) => h.id !== habit.id));
    setConfirmData(null);
    showToast("Habit deleted");
  };
  const togglePause = (habit) => {
    setHabits((prev) => prev.map((h) => (h.id === habit.id ? { ...h, paused: !h.paused } : h)));
    showToast(habit.paused ? "Habit resumed" : "Habit paused");
  };

  const saveTask = (task) => {
    setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev.map((t) => (t.id === task.id ? task : t)) : [...prev, task]));
    setTaskModal(null);
    showToast("Task saved");
  };
  const deleteTask = (task) => { setTasks((prev) => prev.filter((t) => t.id !== task.id)); setConfirmData(null); showToast("Task deleted"); };
  const toggleTask = (id) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));

  const saveNote = (note) => {
    setNotes((prev) => (prev.some((n) => n.id === note.id) ? prev.map((n) => (n.id === note.id ? note : n)) : [...prev, note]));
    setNoteModal(null);
    showToast("Note saved");
  };
  const deleteNote = (note) => { setNotes((prev) => prev.filter((n) => n.id !== note.id)); setConfirmData(null); showToast("Note deleted"); };

  const badges = useMemo(() => {
    const today = todayStr();
    const b = [];
    const bestCurrent = habits.reduce((m, h) => Math.max(m, computeHabitStats(h, completions, today).current), 0);
    const totalCompletions = habits.reduce((m, h) => m + computeHabitStats(h, completions, today).total, 0);
    if (bestCurrent >= 3) b.push({ label: "3 Day Streak" });
    if (bestCurrent >= 7) b.push({ label: "7 Day Streak" });
    if (bestCurrent >= 30) b.push({ label: "30 Day Streak" });
    if (totalCompletions >= 100) b.push({ label: "100 Habit Completions" });
    const last7 = [...Array(7)].map((_, i) => addDays(today, -i));
    const perfectWeek = habits.length > 0 && last7.every((ds) => {
      const due = habits.filter((h) => !h.paused && isDue(h, ds));
      return due.length === 0 || due.every((h) => completions[ds]?.[h.id]);
    }) && habits.some((h) => isDue(h, today));
    if (perfectWeek) b.push({ label: "Perfect Week" });
    return b;
  }, [habits, completions]);

  const surface = mode === "dark" ? "#20222e" : "#ffffff";
  const bg = mode === "dark" ? "#15161f" : "#f7f6fb";
  const text = mode === "dark" ? "#f0eef8" : "#201f2b";
  const border = mode === "dark" ? "#33344a" : "#e9e6f2";
  const track = mode === "dark" ? "#33344a" : "#eeecf7";

  if (!loaded) {
    return (
      <div className="h-full min-h-[500px] flex items-center justify-center" style={{ background: bg }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-4 animate-spin" style={{ borderColor: theme.accent + "33", borderTopColor: theme.accent }} />
          <p className="text-sm opacity-50">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ "--surface": surface, "--bg": bg, "--text": text, "--border": border, "--track": track, "--font-display": "'Fraunces', serif" }}
      className="min-h-[700px] w-full" >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');
        * { font-family: 'Inter', sans-serif; }
        @keyframes toastIn { from { opacity:0; transform: translate(-50%, 10px);} to {opacity:1; transform: translate(-50%,0);} }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: ${border}; border-radius: 8px; }
      `}</style>
      <div style={{ background: "var(--bg)", color: "var(--text)" }} className="min-h-[700px] flex">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-56 shrink-0 border-r p-4 gap-1" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 px-2 mb-6 mt-1">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: `linear-gradient(135deg, ${theme.gradFrom}, ${theme.gradTo})` }}>
              <Flame size={16} />
            </div>
            <span className="font-bold text-sm leading-tight" style={{ fontFamily: "var(--font-display)" }}>Habit Tracker</span>
          </div>
          {NAV_ITEMS.map((item) => (
            <button key={item.id} onClick={() => setView(item.id)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition"
              style={view === item.id ? { background: theme.accent + "18", color: theme.accent } : { color: "var(--text)", opacity: 0.65 }}>
              <item.icon size={17} /> {item.label}
            </button>
          ))}
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="flex items-center justify-between px-5 md:px-8 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="md:hidden flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white" style={{ background: theme.accent }}><Flame size={14} /></div>
              <span className="font-bold text-sm" style={{ fontFamily: "var(--font-display)" }}>Habit Tracker</span>
            </div>
            <h1 className="hidden md:block text-lg font-bold capitalize" style={{ fontFamily: "var(--font-display)" }}>{view}</h1>
            <div className="flex items-center gap-2">
              <button onClick={() => setSettings((s) => ({ ...s, mode: s.mode === "dark" ? "light" : "dark" }))} className="p-2 rounded-xl border" style={{ borderColor: "var(--border)" }}>
                {mode === "dark" ? <Sun size={15} /> : <Moon size={15} />}
              </button>
              <button onClick={() => setView("settings")} className="p-2 rounded-xl border" style={{ borderColor: "var(--border)" }}><Palette size={15} /></button>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: `linear-gradient(135deg, ${theme.gradFrom}, ${theme.gradTo})` }}>
                {settings.name?.[0]?.toUpperCase() || "M"}
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-5 md:px-8 py-6 pb-24 md:pb-8">
            {view === "dashboard" && (
              <Dashboard habits={habits} completions={completions} onToggle={toggleCompletion}
                onNewHabit={() => setHabitModal("new")} onEdit={(h) => setHabitModal(h)}
                onDelete={(h) => setConfirmData({ type: "habit", item: h, title: "Delete habit?", message: `"${h.name}" and all of its recorded progress will be permanently removed.` })}
                onPause={togglePause} theme={theme} settings={settings} tasks={tasks} badges={badges} />
            )}
            {view === "calendar" && (
              <CalendarView habits={habits} completions={completions} month={calendarMonth} setMonth={setCalendarMonth}
                onToggle={toggleCompletion} onDayClick={(d) => setDayModalDate(d)} dayCount={dayCount} setDayCount={setDayCount} theme={theme} />
            )}
            {view === "progress" && <ProgressView habits={habits} completions={completions} theme={theme} mode={mode} />}
            {view === "tasks" && (
              <TasksView tasks={tasks} onNew={() => setTaskModal("new")} onEdit={(t) => setTaskModal(t)}
                onDelete={(t) => setConfirmData({ type: "task", item: t, title: "Delete task?", message: `"${t.title}" will be removed.` })}
                onToggle={toggleTask} theme={theme} />
            )}
            {view === "notes" && (
              <NotesView notes={notes} onNew={() => setNoteModal("new")} onEdit={(n) => setNoteModal(n)}
                onDelete={(n) => setConfirmData({ type: "note", item: n, title: "Delete note?", message: `"${n.title}" will be removed.` })} theme={theme} />
            )}
            {view === "settings" && <SettingsView settings={settings} setSettings={setSettings} theme={theme} />}
          </main>

          {/* Bottom nav (mobile) */}
          <nav className="md:hidden fixed bottom-0 inset-x-0 flex justify-around items-center py-2 border-t z-50" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            {NAV_ITEMS.map((item) => (
              <button key={item.id} onClick={() => setView(item.id)} className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg" style={view === item.id ? { color: theme.accent } : { opacity: 0.5 }}>
                <item.icon size={19} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {habitModal && (
        <HabitFormModal initial={habitModal === "new" ? null : habitModal} onClose={() => setHabitModal(null)} onSave={saveHabit} theme={theme} />
      )}
      {taskModal && (
        <TaskModal initial={taskModal === "new" ? null : taskModal} onClose={() => setTaskModal(null)} onSave={saveTask} theme={theme} />
      )}
      {noteModal && (
        <NoteModal initial={noteModal === "new" ? null : noteModal} onClose={() => setNoteModal(null)} onSave={saveNote} theme={theme} />
      )}
      {dayModalDate && (
        <DayDetailModal dateStr={dayModalDate} habits={habits} completions={completions} onClose={() => setDayModalDate(null)} onToggle={toggleCompletion} theme={theme} />
      )}
      <ConfirmDialog data={confirmData} onCancel={() => setConfirmData(null)}
        onConfirm={() => {
          if (confirmData.type === "habit") deleteHabit(confirmData.item);
          if (confirmData.type === "task") deleteTask(confirmData.item);
          if (confirmData.type === "note") deleteNote(confirmData.item);
        }} />
      <Toast toast={toast} />
    </div>
  );
}
