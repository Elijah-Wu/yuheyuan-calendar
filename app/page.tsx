"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import Login from "./login/page";

type CalendarEvent = {
  id: string;
  event_type: "client" | "private" | "important";
  title: string;
  start_date: string;
end_date: string | null;
  start_time: string | null;
  duration_minutes: number | null;
amount: number | null;
reminder_minutes: number | null;
  notes: string | null;
  color: string;
};

const COLORS = [
  "#F5C84C",
  "#6FA8DC",
  "#9B7EDC",
  "#79B88A",
  "#E57373",
  "#F39AC1",
];

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  const [currentDate, setCurrentDate] = useState(new Date(2000, 0, 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  const [eventType, setEventType] =
    useState<CalendarEvent["event_type"]>("client");
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("09:30");
  const [duration, setDuration] = useState(60);
const [amount, setAmount] = useState("");
const [reminderMinutes, setReminderMinutes] = useState(120);
  const [notes, setNotes] = useState("");
  const [color, setColor] = useState(COLORS[1]);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
const [isMultiDay, setIsMultiDay] = useState(false);
const [endDate, setEndDate] = useState("");
const [showIncome, setShowIncome] = useState(false);
const [showSearch, setShowSearch] = useState(false);
const [searchQuery, setSearchQuery] = useState("");
const [notificationPermission, setNotificationPermission] = useState<
  NotificationPermission | "unsupported"
>("default");

  useEffect(() => {
setCurrentDate(new Date());

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}

if ("Notification" in window) {
  setNotificationPermission(Notification.permission);
} else {
  setNotificationPermission("unsupported");
}
    checkLogin();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session);
      setLoading(false);

      if (session) {
        loadEvents();
      } else {
        setEvents([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkLogin() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    setLoggedIn(!!session);
    setLoading(false);

    if (session) {
      await loadEvents();
    }
  }

  async function loadEvents() {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
  console.error("讀取行程失敗：", error);
  return;
}

    setEvents((data ?? []) as CalendarEvent[]);
  }

  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
  }

  async function enableNotifications() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      alert("這個裝置目前不支援網頁通知。");
      setNotificationPermission("unsupported");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === "granted") {
        const registration = await navigator.serviceWorker.ready;
        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicKey) throw new Error("找不到 VAPID Public Key");

        const existingSubscription = await registration.pushManager.getSubscription();
        const pushSubscription = existingSubscription ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error("目前沒有登入帳號");
        const subscriptionJson = pushSubscription.toJSON();
        if (!subscriptionJson.endpoint || !subscriptionJson.keys?.p256dh || !subscriptionJson.keys?.auth) throw new Error("Push Subscription 資料不完整");
        const { error: subscriptionError } = await supabase.from("push_subscriptions").upsert({ user_id: session.user.id, endpoint: subscriptionJson.endpoint, p256dh: subscriptionJson.keys.p256dh, auth: subscriptionJson.keys.auth }, { onConflict: "endpoint" });
        if (subscriptionError) throw subscriptionError;
        await registration.showNotification("宇和苑行事曆", { body: "通知已成功開啟。" });
      } else if (permission === "denied") {
        alert("通知權限目前被關閉。請到 iPhone 設定中允許通知後再試一次。");
      }
    } catch (error) {
      console.error("開啟通知失敗：", error);

      let errorMessage = "未知錯誤";

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (
        typeof error === "object" &&
        error !== null &&
        "message" in error
      ) {
        errorMessage = String((error as { message?: unknown }).message);
      } else {
        errorMessage = String(error);
      }

      alert(`開啟通知失敗：\n${errorMessage}`);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  function dateKey(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");

    return `${y}-${m}-${d}`;
  }

  function sameDay(a: Date, b: Date) {
    return dateKey(a) === dateKey(b);
  }

  function previousMonth() {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    );
  }

  function nextMonth() {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    );
  }

  function goToday() {
    setCurrentDate(new Date());
  }

  function openAdd() {
setEditingEvent(null);
    setEventType("client");
    setTitle("");
    setStartTime("09:30");
    setDuration(60);
setAmount("");
setReminderMinutes(120);
    setNotes("");
    setColor(COLORS[1]);
setIsMultiDay(false);
setEndDate(selectedDate ? dateKey(selectedDate) : "");
    setShowAdd(true);
  }

function openEdit(event: CalendarEvent) {
  setEditingEvent(event);
  setEventType(event.event_type);
  setTitle(event.title);
  setStartTime(event.start_time || "09:30");
  setDuration(event.duration_minutes || 60);
setAmount(event.amount != null ? String(event.amount) : "");
setReminderMinutes(event.reminder_minutes ?? 120);
  setNotes(event.notes || "");
  setColor(event.color);
setIsMultiDay(
  !!event.end_date && event.end_date !== event.start_date
);
setEndDate(event.end_date || event.start_date);
  setShowAdd(true);
}

  async function saveEvent() {
    if (!selectedDate) return;

    if (!title.trim()) {
      alert(eventType === "client" ? "請輸入客戶姓名" : "請輸入行程名稱");
      return;
    }

    setSaving(true);

    let error;

const eventData = {
  event_type: eventType,
  title: title.trim(),
  start_date: dateKey(selectedDate),
  end_date: isMultiDay ? endDate : dateKey(selectedDate),
  start_time: isMultiDay ? null : startTime || null,
duration_minutes: isMultiDay ? null : duration,
amount: eventType === "client" && amount.trim() !== "" ? Number(amount) : null,
reminder_minutes: eventType === "client" && !isMultiDay ? reminderMinutes : null,
  notes: notes.trim() || null,
  color,
  reminder_sent_at: null,
};

if (editingEvent) {
  const result = await supabase
    .from("events")
    .update(eventData)
    .eq("id", editingEvent.id);

  error = result.error;
} else {
  const result = await supabase
    .from("events")
    .insert(eventData);

  error = result.error;
}

    setSaving(false);

    if (error) {
      console.error(error);
      alert("儲存失敗：" + error.message);
      return;
    }

    await loadEvents();
    setShowAdd(false);
  }
async function deleteEvent() {
  if (!editingEvent) return;

  const ok = confirm(`確定要刪除「${editingEvent.title}」嗎？`);
  if (!ok) return;

  setSaving(true);

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", editingEvent.id);

  setSaving(false);

  if (error) {
    console.error(error);
    alert("刪除失敗：" + error.message);
    return;
  }

  await loadEvents();
  setEditingEvent(null);
  setShowAdd(false);
}
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const result: (Date | null)[] = [];

    for (let i = 0; i < firstDay.getDay(); i++) {
      result.push(null);
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      result.push(new Date(year, month, day));
    }

    while (result.length % 7 !== 0) {
      result.push(null);
    }

    return result;
  }, [currentDate]);

const monthlyIncome = useMemo(() => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  return events
    .filter((event) => {
      if (event.event_type !== "client") return false;
      if (event.amount == null) return false;

      const [eventYear, eventMonth] = event.start_date
        .split("-")
        .map(Number);

      return eventYear === year && eventMonth === month + 1;
    })
    .reduce((total, event) => total + (event.amount ?? 0), 0);
}, [events, currentDate]);
  
const selectedEvents = selectedDate
  ? events.filter((event) => {
      const selected = dateKey(selectedDate);
      const end = event.end_date || event.start_date;

      return event.start_date <= selected && end >= selected;
    })
  : [];

const normalizedSearchQuery = searchQuery.trim().toLowerCase();

const searchResults = normalizedSearchQuery
  ? events
      .filter((event) =>
        [event.title, event.notes ?? ""].some((value) =>
          value.toLowerCase().includes(normalizedSearchQuery)
        )
      )
      .sort((a, b) => {
        const aKey = `${a.start_date} ${a.start_time ?? "00:00"}`;
        const bKey = `${b.start_date} ${b.start_time ?? "00:00"}`;
        return bKey.localeCompare(aKey);
      })
  : [];

function openSearchResult(event: CalendarEvent) {
  const [year, month, day] = event.start_date.split("-").map(Number);
  const eventDate = new Date(year, month - 1, day);

  setSelectedDate(eventDate);
  setCurrentDate(new Date(year, month - 1, 1));
  setShowSearch(false);
  setSearchQuery("");
  openEdit(event);
}

  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50">
        <p className="text-stone-500">載入中...</p>
      </main>
    );
  }

  if (!loggedIn) {
    return <Login />;
  }

  return (
    <main className="min-h-screen bg-stone-100 p-3 sm:p-6">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-white shadow-sm">
        <header className="border-b border-stone-200 px-4 py-5 sm:px-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-stone-900 sm:text-2xl">
                宇_行事曆
              </h1>

              <p className="mt-1 text-sm text-stone-500">
                預約・私人行程・重要事項
              </p>
            </div>

            <div className="flex items-center gap-2">
              {notificationPermission !== "granted" && (
                <button
                  onClick={enableNotifications}
                  className="rounded-xl bg-stone-900 px-3 py-2 text-sm font-medium text-white"
                >
                  開啟通知
                </button>
              )}

              {notificationPermission === "granted" && (
                <button
                  onClick={enableNotifications}
                  className="rounded-xl bg-green-50 px-3 py-2 text-sm font-medium text-green-700"
                  title="點一下可重新確認並儲存推播訂閱"
                >
                  通知已開啟
                </button>
              )}

              <button
                onClick={logout}
                className="rounded-xl border border-stone-300 px-4 py-2 text-sm text-stone-600"
              >
                登出
              </button>
            </div>
          </div>
        </header>

        <section className="p-3 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={goToday}
              className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-900"
            >
              回到今天
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={previousMonth}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-300 text-xl font-semibold text-stone-900"
              >
                ‹
              </button>

              <h2 className="min-w-[140px] text-center text-lg font-bold text-stone-900">
                {currentDate.getFullYear()} 年 {currentDate.getMonth() + 1} 月
              </h2>

              <button
                onClick={nextMonth}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-300 text-xl text-stone-900"
              >
                ›
              </button>
            </div>

<button
  type="button"
  onClick={() => setShowIncome((value) => !value)}
  className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-900"
>
  {showIncome
    ? `本月收入：$${monthlyIncome.toLocaleString()}`
    : "查看收入"}
</button>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setShowSearch(true);
              }}
              className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-900"
            >
              搜尋
            </button>
          </div>

          <div className="grid grid-cols-7 border-l border-t border-stone-200">
            {weekdays.map((day) => (
              <div
                key={day}
                className="border-b border-r border-stone-200 bg-stone-50 py-2 text-center text-xs font-medium text-stone-500 sm:text-sm"
              >
                {day}
              </div>
            ))}

            {calendarDays.map((date, index) => {
              if (!date) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="h-[142px] border-b border-r border-stone-200 bg-stone-50/50 sm:h-[150px]"
                  />
                );
              }

              const today = sameDay(date, new Date());

              const dayEvents = events.filter((event) => {
  const current = dateKey(date);
  const end = event.end_date || event.start_date;

  return event.start_date <= current && end >= current;
});

              return (
                <button
                  key={dateKey(date)}
                  onClick={() => setSelectedDate(date)}
                  className="flex h-[142px] flex-col items-stretch justify-start overflow-hidden border-b border-r border-stone-200 bg-white p-1.5 text-left hover:bg-stone-50 sm:h-[150px] sm:p-2"
                >
                  <span
                    className={
                      today
                        ? "flex h-7 w-7 items-center justify-center rounded-full bg-stone-900 text-xs font-bold text-white"
                        : "flex h-7 w-7 items-center justify-center text-xs font-medium text-stone-700"
                    }
                  >
                    {date.getDate()}
                  </span>
<div className="mt-1 space-y-1">
  {dayEvents.slice(0, 3).map((event) => {
    const isMultiDay =
      !!event.end_date && event.end_date !== event.start_date;

    const current = dateKey(date);
    const isStart = current === event.start_date;
    const isEnd = current === event.end_date;

    return (
      <div
        key={event.id}
        className={`truncate px-1 py-1 text-[11px] font-medium text-stone-800 sm:text-sm ${
          isMultiDay
            ? `${isStart ? "rounded-l-md" : ""} ${
                isEnd ? "rounded-r-md" : ""
              }`
            : "rounded-md"
        }`}
        style={{
          backgroundColor: event.color,
          marginLeft: isMultiDay && !isStart ? "-8px" : undefined,
          marginRight: isMultiDay && !isEnd ? "-8px" : undefined,
        }}
      >
        {isMultiDay ? (
          isStart ? (
            event.title
          ) : (
            <span>&nbsp;</span>
          )
        ) : (
          event.title
        )}
      </div>
    );
  })}

  {dayEvents.length > 3 && (
    <p className="px-1 text-xs text-stone-500 sm:text-sm">
      +{dayEvents.length - 3} 筆
    </p>
  )}
</div>
                   	                </button>
              );
            })}
          </div>
        </section>
      </div>

      {showSearch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowSearch(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-sm text-stone-500">搜尋行程</p>
                <h3 className="mt-1 text-2xl font-bold text-stone-900">
                  客戶・行程搜尋
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setShowSearch(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-xl text-stone-900"
              >
                ×
              </button>
            </div>

            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="輸入客戶姓名、行程名稱或備註"
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-stone-900 placeholder:text-stone-500"
            />

            <div className="mt-4 max-h-[430px] space-y-2 overflow-y-auto">
              {!normalizedSearchQuery ? (
                <div className="rounded-2xl bg-stone-50 px-4 py-6 text-center text-sm text-stone-500">
                  輸入關鍵字開始搜尋
                </div>
              ) : searchResults.length === 0 ? (
                <div className="rounded-2xl bg-stone-50 px-4 py-6 text-center text-sm text-stone-500">
                  找不到符合的行程
                </div>
              ) : (
                searchResults.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => openSearchResult(event)}
                    className="block w-full rounded-2xl border border-stone-200 px-4 py-3 text-left transition hover:bg-stone-50"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: event.color }}
                      />
                      <p className="font-bold text-stone-900">{event.title}</p>
                    </div>

                    <p className="mt-1 text-sm font-medium text-stone-700">
                      {event.start_date.replaceAll("-", "/")}
                      {event.start_time ? ` · ${event.start_time.slice(0, 5)}` : ""}
                    </p>

                    {event.notes && (
                      <p className="mt-1 truncate text-sm text-stone-500">
                        {event.notes}
                      </p>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {selectedDate && !showAdd && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setSelectedDate(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-sm text-stone-500">當日行程</p>

                <h3 className="mt-1 text-2xl font-bold text-stone-900">
                  {selectedDate.getMonth() + 1} 月 {selectedDate.getDate()} 日
                </h3>
              </div>

              <button
                onClick={() => setSelectedDate(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-xl text-stone-900"
              >
                ×
              </button>
            </div>

            {selectedEvents.length === 0 ? (
              <div className="rounded-2xl bg-stone-50 px-4 py-6 text-center text-sm text-stone-500">
                這一天目前沒有行程
              </div>
            ) : (
              <div className="max-h-[430px] space-y-2 overflow-y-auto">
                {selectedEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => openEdit(event)}
                    className="block w-full rounded-2xl border border-stone-200 px-4 py-3 text-left transition hover:bg-stone-50"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: event.color }}
                      />

                      <p className="font-bold text-stone-900">{event.title}</p>
                    </div>

                    {event.end_date && event.end_date !== event.start_date ? (
  <p className="mt-1 text-base font-medium text-stone-700">
    {event.start_date.replaceAll("-", "/")} ～ {event.end_date.replaceAll("-", "/")}
  </p>
) : (
  <p className="mt-1 font-medium text-stone-700">
    <span className="text-lg">
      {event.start_time
        ? event.start_time.slice(0, 5)
        : "未設定時間"}
    </span>
    {event.duration_minutes && (
      <span className="text-base">{` · ${event.duration_minutes} 分鐘`}</span>
    )}
  </p>
)}

{event.event_type === "client" && event.amount != null && (
  <p className="mt-1 text-sm font-semibold text-stone-700">
    ${event.amount.toLocaleString()}
  </p>
)}

                    {event.notes && (
                      <p className="mt-1 text-sm text-stone-500">
                        {event.notes}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={openAdd}
              className="mt-5 w-full rounded-2xl bg-stone-900 py-3.5 font-medium text-white"
            >
              ＋ 新增行程
            </button>
          </div>
        </div>
      )}

      {showAdd && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 text-stone-900 shadow-xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-sm text-stone-500">
                  {selectedDate.getFullYear()} 年{" "}
                  {selectedDate.getMonth() + 1} 月{" "}
                  {selectedDate.getDate()} 日
                </p>

                <h3 className="mt-1 text-2xl font-bold">
  {editingEvent ? "修改行程" : "新增行程"}
</h3>
              </div>

              <button
                onClick={() => {
  setShowAdd(false);
  setEditingEvent(null);
}}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-xl font-semibold text-stone-900"
              >
                ×
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-stone-900">
                  行程類型
                </label>

                <select
                  value={eventType}
                  onChange={(e) =>
                    setEventType(
                      e.target.value as CalendarEvent["event_type"]
                    )
                  }
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-stone-900 placeholder:text-stone-500"
                >
                  <option value="client">客戶預約</option>
                  <option value="private">私人行程</option>
                  <option value="important">休假・重要事項</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-stone-900">
                  {eventType === "client" ? "客戶姓名" : "行程名稱"}
                </label>

                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    eventType === "client"
                      ? "請輸入客戶姓名"
                      : "請輸入行程名稱"
                  }
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-stone-900 placeholder:text-stone-500"
                />
              </div>

{!isMultiDay && (              
<div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-900">
                    開始時間
                  </label>

                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-stone-900 placeholder:text-stone-500"
                  />
                </div>
  

                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-900">
                    時長
                  </label>

                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-stone-900 placeholder:text-stone-500"
                  >
                    <option value={30}>30 分鐘</option>
                    <option value={60}>60 分鐘</option>
                    <option value={90}>90 分鐘</option>
                    <option value={120}>120 分鐘</option>
                  </select>
                </div>
              </div>
)}

{eventType === "client" && (
  <div>
    <label className="mb-2 block text-sm font-medium text-stone-900">
      金額
    </label>

    <input
      type="number"
      min="0"
      step="1"
      value={amount}
      onChange={(e) => setAmount(e.target.value)}
      placeholder="請輸入金額"
      className="w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-stone-900 placeholder:text-stone-500"
    />
  </div>
)}

{eventType === "client" && !isMultiDay && (
  <div>
    <label className="mb-2 block text-sm font-medium text-stone-900">
      提醒
    </label>

    <select
      value={reminderMinutes}
      onChange={(e) => setReminderMinutes(Number(e.target.value))}
      className="w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-stone-900 placeholder:text-stone-500"
    >
      <option value={30}>30 分鐘前</option>
      <option value={60}>1 小時前</option>
      <option value={120}>2 小時前</option>
      <option value={0}>不提醒</option>
    </select>
  </div>
)}

<div className="rounded-xl border border-stone-200 p-3">
  <label className="flex items-center gap-3">
    <input
      type="checkbox"
      checked={isMultiDay}
      onChange={(e) => setIsMultiDay(e.target.checked)}
      className="h-5 w-5"
    />
    <span className="text-sm font-medium text-stone-900">跨日行程</span>
  </label>

  {isMultiDay && (
    <div className="mt-3">
      <label className="mb-2 block text-sm font-medium text-stone-900">
        結束日期
      </label>
      <input
        type="date"
        value={endDate}
        min={selectedDate ? dateKey(selectedDate) : undefined}
        onChange={(e) => setEndDate(e.target.value)}
        className="w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-stone-900 placeholder:text-stone-500"
      />
    </div>
  )}
</div>

              <div>
                <label className="mb-2 block text-sm font-medium text-stone-900">顏色</label>

                <div className="flex flex-wrap gap-3">
                  {COLORS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setColor(item)}
                      className={`h-10 w-10 rounded-full ${
                        color === item
                          ? "ring-2 ring-stone-900 ring-offset-2"
                          : ""
                      }`}
                      style={{ backgroundColor: item }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-stone-900">
                  備註
                </label>

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="可留空"
                  className="w-full resize-none rounded-xl border border-stone-300 bg-white px-3 py-3 text-stone-900 placeholder:text-stone-500"
                />
              </div>

              <button
                onClick={saveEvent}
                disabled={saving}
                className="w-full rounded-2xl bg-stone-900 py-3.5 font-medium text-white disabled:opacity-50"
              >
                {saving ? "儲存中..." : "儲存行程"}
              </button>
{editingEvent && (
  <button
    type="button"
    onClick={deleteEvent}
    disabled={saving}
    className="mt-3 w-full rounded-2xl border border-red-300 py-3.5 font-medium text-red-600 disabled:opacity-50"
  >
    刪除行程
  </button>
)}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}