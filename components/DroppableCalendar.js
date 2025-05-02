"use client";

import React, { useEffect, useRef, useState } from "react";
import moment from "moment-timezone";
import { momentLocalizer } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import dynamic from "next/dynamic";

const Calendar = dynamic(() => import("react-big-calendar").then(mod => mod.Calendar), {
  ssr: false
});


moment.locale("he");
moment.tz.setDefault("Asia/Jerusalem");
const localizer = momentLocalizer(moment);

// ✅ Define your custom event layout
const CustomEvent = ({ event }) => (
  <div style={{
    direction: "rtl",
    textAlign: "right",
    padding: "4px",
    margin: 0,
    lineHeight: "1.3",
    whiteSpace: "normal",
    height: "auto"
  }}>
    <div style={{ fontSize: "10px", color: "#E5E7EB" }}>
      {moment(event.start).format("HH:mm")}
    </div>
    <div style={{ fontSize: "12px", fontWeight: "600", color: "white" }}>
      {event.resource?.data?.category ? `${event.resource.data.category}: ` : ""}
      {event.resource?.data?.title || event.title}
    </div>
  </div>
);
const CustomEventWrapper = ({ children }) => (
  <div style={{ overflow: "hidden", height: "100%" }}>
    {children}
  </div>
);

export default function DroppableCalendar({
  events,
  view,
  onView,
  selectedDate,
  setSelectedDate,
  onEventDrop,
  components: customComponents,
  currentUser,
  messages,
}) {
  const calendarRef = useRef(null);
  const [currentView, setCurrentView] = useState(view || "week");
  const [showOnlyMine, setShowOnlyMine] = useState(true);

  // Helper: get user identifiers
  const getUserIdentifiers = () => {
    if (!currentUser) return [];
    return [currentUser.email, currentUser.alias].filter(Boolean);
  };
  const userIdentifiers = getUserIdentifiers();

  // Filter events if toggle is ON
  const filteredEvents = showOnlyMine && userIdentifiers.length > 0
    ? events.filter(event => userIdentifiers.includes(event.assignTo))
    : events;

  useEffect(() => {
    const savedView = localStorage.getItem("calendarView");
    if (savedView) {
      setCurrentView(savedView);
      onView(savedView);
    }
  }, [onView]);

  const handleViewChange = (newView) => {
    setCurrentView(newView);
    localStorage.setItem("calendarView", newView);
    onView(newView);
  };

  useEffect(() => {
    if (currentView === "day" && calendarRef.current) {
      const now = new Date();
      const calendarEl = calendarRef.current;
      const hourHeight = 40;
      const scrollTop = now.getHours() * hourHeight - calendarEl.clientHeight / 2;
      calendarEl.scrollTop = scrollTop > 0 ? scrollTop : 0;
    }
  }, [currentView, events]);

  const handleEventDrop = ({ event, start }) => {
    if (onEventDrop && typeof onEventDrop === "function") {
      onEventDrop(event, start);
    }
  };

  // Default components if not provided
  const defaultComponents = {
    event: CustomEvent,
    eventWrapper: CustomEventWrapper
  };
  const components = customComponents ? { ...defaultComponents, ...customComponents } : defaultComponents;

  // Color logic for others' tasks
  const eventPropGetter = (event) => {
    const isMine = userIdentifiers.includes(event.assignTo);
    return {
      style: {
        textAlign: "right",
        direction: "rtl",
        backgroundColor: event.resource?.type === "task"
          ? event.isDone
            ? "#a1a1aa"
            : isMine
              ? "#3b82f6" // blue for mine
              : "#f59e42" // orange for others
          : isMine ? "#10b981" : "#f59e42", // green for mine, orange for others
        opacity: event.resource?.type === "task" && event.isDone ? 0.7 : 1,
        borderRadius: "5px",
        color: "white",
        border: "0px",
        display: "block",
        padding: "4px",
        fontSize: "0.85rem"
      },
    };
  };

  // Working hours
  const WORK_START = 8;
  const WORK_END = 20;
  const minTime = new Date();
  minTime.setHours(WORK_START, 0, 0, 0);
  const maxTime = new Date();
  maxTime.setHours(WORK_END, 0, 0, 0);

  // Style non-working hours
  const slotPropGetter = (date) => {
    const hour = date.getHours();
    if (hour < WORK_START || hour >= WORK_END) {
      return {
        style: {
          backgroundColor: '#f3f4f6', // light gray
        },
      };
    }
    return {};
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", position: "relative" }}>
      {/* Toggle Switch - absolutely positioned higher, label right, checkbox left */}
      <div style={{ position: "absolute", top: -32, right: 0, display: "flex", alignItems: "center", flexDirection: "row", zIndex: 2 }}>
        <label style={{ fontWeight: 500 }}>
          הצג רק משימות שלי
        </label>
        <input
          type="checkbox"
          checked={showOnlyMine}
          onChange={() => setShowOnlyMine(v => !v)}
          style={{ width: 20, height: 20, marginRight: 8 }}
        />
      </div>
      <div ref={calendarRef} style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <Calendar
          localizer={localizer}
          events={filteredEvents}
          startAccessor="start"
          endAccessor="end"
          defaultView={currentView}
          view={currentView}
          onView={handleViewChange}
          date={selectedDate}
          onNavigate={(date) => setSelectedDate(date)}
          draggableAccessor={() => true}
          onEventDrop={handleEventDrop}
          style={{ direction: "rtl" }}
          eventPropGetter={eventPropGetter}
          components={components}
          min={minTime}
          max={maxTime}
          slotPropGetter={slotPropGetter}
          messages={messages}
        />
      </div>
    </div>
  );
}
