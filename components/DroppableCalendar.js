"use client";
import { useDroppable } from "@dnd-kit/core";
import { Calendar as RBCalendar, momentLocalizer } from "react-big-calendar";
import moment from "moment-timezone";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useEffect, useState } from "react";

// Set locale to Hebrew and default time zone to Israel.
moment.locale("he");
moment.tz.setDefault("Asia/Jerusalem");
const localizer = momentLocalizer(moment);

// Define formats to force 24-hour time display.
const formats = {
  timeGutterFormat: (date, culture, localizer) => localizer.format(date, "HH:mm", culture),
  eventTimeRangeFormat: ({ start, end }, culture, localizer) =>
    `${localizer.format(start, "HH:mm", culture)} - ${localizer.format(end, "HH:mm", culture)}`,
  agendaTimeFormat: (date, culture, localizer) => localizer.format(date, "HH:mm", culture),
};

export default function DroppableCalendar({ events, view, onView, selectedDate, setSelectedDate }) {
  const { setNodeRef } = useDroppable({
    id: "calendar-dropzone",
  });
  
  // State for current time indicator position (only in daily view)
  const [indicatorTop, setIndicatorTop] = useState(null);
  
  useEffect(() => {
    if (view === "day") {
      const now = new Date();
      const dayStart = new Date(selectedDate);
      dayStart.setHours(0, 0, 0, 0);
      if (now.toDateString() === selectedDate.toDateString()) {
        // Assuming the container height is 500px as set in style.
        const containerHeight = 500;
        const diffMs = now - dayStart;
        const fraction = diffMs / (24 * 60 * 60 * 1000);
        const top = fraction * containerHeight;
        setIndicatorTop(top);
      } else {
        setIndicatorTop(null);
      }
    } else {
      setIndicatorTop(null);
    }
    
    // Update indicator every minute.
    const interval = setInterval(() => {
      if (view === "day") {
        const now = new Date();
        const dayStart = new Date(selectedDate);
        dayStart.setHours(0, 0, 0, 0);
        if (now.toDateString() === selectedDate.toDateString()) {
          const containerHeight = 500;
          const diffMs = now - dayStart;
          const fraction = diffMs / (24 * 60 * 60 * 1000);
          const top = fraction * containerHeight;
          setIndicatorTop(top);
        } else {
          setIndicatorTop(null);
        }
      }
    }, 60000);
    
    return () => clearInterval(interval);
  }, [view, selectedDate]);
  
  return (
    <div
      ref={setNodeRef}
      id="calendar-dropzone"
      className="calendar-wrapper"
      style={{ height: 500, position: "relative", border: "2px dashed #aaa" }}
    >
      <RBCalendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        view={view}
        onView={onView}
        date={selectedDate}
        onNavigate={setSelectedDate}
        formats={formats}
        style={{ height: "100%" }}
      />
      {indicatorTop !== null && (
        <div
          style={{
            position: "absolute",
            top: indicatorTop,
            left: 0,
            width: "100%",
            borderTop: "2px dotted rgba(255, 0, 0, 0.5)",
            pointerEvents: "none",
            zIndex: 100,
          }}
        />
      )}
    </div>
  );
}
