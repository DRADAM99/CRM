
import React, { useEffect, useRef, useState } from "react";
import { Calendar, Views, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";

const localizer = momentLocalizer(moment);

export default function DroppableCalendar({
  events,
  view,
  onView,
  selectedDate,
  setSelectedDate,
  onEventDrop
}) {
  const calendarRef = useRef(null);
  const [currentView, setCurrentView] = useState(view || "week");

  // 1. Persist calendar view to localStorage
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

  // 2. Center time in daily view
  useEffect(() => {
    if (currentView === "day") {
      const scrollContainer = document.querySelector(".rbc-time-content");
      if (scrollContainer) {
        const now = new Date();
        const hours = now.getHours();
        const scrollHeight = scrollContainer.scrollHeight;
        const hourBlockHeight = scrollHeight / 24;
        scrollContainer.scrollTop = hourBlockHeight * hours - scrollContainer.clientHeight / 2;
      }
    }
  }, [currentView, events]);

  return (
    <div ref={calendarRef} style={{ height: "80vh" }}>
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
        style={{ direction: "rtl" }}
        onEventDrop={onEventDrop}
        draggableAccessor={() => true}
        popup
        eventPropGetter={() => ({
          style: {
            textAlign: "right",
            paddingRight: "8px"
          },
        })}
        components={{
          event: ({ event }) => (
            <div style={{ direction: "rtl" }}>
              <strong>{event.title}</strong>
              {event.subtitle && <div>{event.subtitle}</div>}
            </div>
          ),
        }}
      />
    </div>
  );
}
