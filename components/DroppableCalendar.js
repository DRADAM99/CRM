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
}) {
  const calendarRef = useRef(null);
  const [currentView, setCurrentView] = useState(view || "week");

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

  return (
    <div ref={calendarRef} style={{ height: "100%", maxHeight: "100%", overflowY: "auto" }}>
      <Calendar
        localizer={localizer}
        events={events}
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
        eventPropGetter={(event) => ({
          style: {
            textAlign: "right",
            direction: "rtl",
            backgroundColor: event.resource?.type === "task"
              ? event.isDone ? "#a1a1aa" : "#3b82f6"
              : "#10b981",
            opacity: event.resource?.type === "task" && event.isDone ? 0.7 : 1,
            borderRadius: "5px",
            color: "white",
            border: "0px",
            display: "block",
            padding: "4px",
            fontSize: "0.85rem"
          },
        })}
        components={{
          event: CustomEvent,
          eventWrapper: CustomEventWrapper  // ✅ plugs in the separate, working override
        }}
      />
    </div>
  );
}
