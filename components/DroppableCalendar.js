"use client";

import { useDroppable } from "@dnd-kit/core";
import { Calendar as RBCalendar, momentLocalizer } from "react-big-calendar";
import moment from "moment-timezone";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useEffect, useState, useCallback, useRef } from "react"; // Added useRef

// Set locale to Hebrew and default time zone to Israel.
moment.locale("he");
moment.tz.setDefault("Asia/Jerusalem");
const localizer = momentLocalizer(moment);

// Define Hebrew messages for the calendar (can be overridden by prop)
const defaultMessages = {
  allDay: "כל היום",
  previous: "הקודם",
  next: "הבא",
  today: "היום",
  month: "חודש",
  week: "שבוע",
  day: "יום",
  agenda: "סדר יום",
  date: "תאריך",
  time: "זמן",
  event: "אירוע",
  noEventsInRange: "אין אירועים בטווח זה",
  showMore: (total) => `+ ${total} נוספים`,
};

// Accept 'messages' prop and use default if not provided
export default function DroppableCalendar({
  events,
  view,
  onView,
  selectedDate,
  setSelectedDate,
  onSelectEvent,
  messages = defaultMessages // Use passed messages or fallback to default
}) {
  const { setNodeRef } = useDroppable({
    id: "calendar-dropzone",
  });

  // Ref for the calendar container div to get its height
  const calendarContainerRef = useRef(null);

  // State for current time indicator position
  const [indicatorTop, setIndicatorTop] = useState(null);

  // --- Refactored useEffect for Time Indicator ---
  useEffect(() => {
    let intervalId = null;

    // Function to calculate and set the indicator position
    const updateIndicatorPosition = () => {
      const now = new Date();
      // Get height from the ref'd container
      const containerHeight = calendarContainerRef.current?.getBoundingClientRect().height;

      // Only proceed if view is 'day', selectedDate is valid, AND we have container height
      if (view === "day" && selectedDate instanceof Date && !isNaN(selectedDate.getTime()) && containerHeight > 0) {
        // Check if the selected date is today
        if (now.toDateString() === selectedDate.toDateString()) {
          // --- Calculate indicator position ---
          try {
            const dayStart = new Date(selectedDate);
            dayStart.setHours(0, 0, 0, 0);

            const diffMs = now.getTime() - dayStart.getTime();
            const fraction = diffMs / (24 * 60 * 60 * 1000); // Fraction of the day passed
            const top = Math.max(0, Math.min(containerHeight, fraction * containerHeight)); // Clamp value

            setIndicatorTop(top);

          } catch (error) {
            console.error("Error calculating time indicator position:", error);
            setIndicatorTop(null); // Hide indicator on calculation error
          }
        } else {
          // It's 'day' view, but not today - hide indicator
          setIndicatorTop(null);
        }
      } else {
        // View is not 'day' or selectedDate is invalid or height unknown - hide indicator
        if (view === "day" && !(selectedDate instanceof Date && !isNaN(selectedDate.getTime()))) {
             console.warn("DroppableCalendar useEffect: selectedDate is invalid.", selectedDate);
        }
        setIndicatorTop(null);
      }
    };

    // Run the calculation immediately when effect runs
    updateIndicatorPosition();

    // Set up the interval to update every minute ONLY if indicator might be visible
    // (Today in day view)
    if (view === "day" && selectedDate instanceof Date && !isNaN(selectedDate.getTime()) && new Date().toDateString() === selectedDate.toDateString()) {
        intervalId = setInterval(updateIndicatorPosition, 60000); // Update every 60 seconds
    }

    // Cleanup function: clear interval when effect re-runs or component unmounts
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };

    // Dependencies: Effect should re-run if view or selected date changes
  }, [view, selectedDate]); // Dependency array

  // Memoize event prop getter
  const eventPropGetter = useCallback(
    (event, start, end, isSelected) => ({
      // Add styles or classes based on event properties (e.g., event.isDone)
      className: `${event.isDone ? 'opacity-50 bg-gray-300' : ''}`,
      style: {
        // Add specific styles if needed
      },
    }),
    [] // No dependencies needed if styling is static based on event props
  );


  return (
    // Assign the ref to the container div
    <div
      ref={(node) => {
        setNodeRef(node); // From useDroppable
        calendarContainerRef.current = node; // Assign ref for height calculation
      }}
      id="calendar-dropzone"
      className="calendar-wrapper relative border-2 border-dashed border-gray-300 h-full" // Added h-full
      // Relies on parent setting a height via className (e.g., h-[calc(...)])
    >
      <RBCalendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        view={view}
        onView={onView} // Prop for changing view (e.g., clicking Month/Week/Day)
        date={selectedDate} // Controlled current date
        onNavigate={setSelectedDate} // Prop for handling date changes (e.g., clicking arrows)
        onSelectEvent={onSelectEvent} // Prop for handling event clicks
        messages={messages} // Pass the messages prop down
        style={{ height: "100%" }} // RBCalendar fills the container div
        eventPropGetter={eventPropGetter} // Apply custom styles/classes to events
      />
      {/* Current Time Indicator Line */}
      {indicatorTop !== null && (
        <div
          // Changed to solid border, increased z-index
          className="absolute left-0 w-full border-t-2 border-solid border-red-500 opacity-90 pointer-events-none"
          style={{
            top: `${indicatorTop}px`, // Position based on state
            zIndex: 20, // Ensure visibility
          }}
          title={`Current time: ${moment().format('HH:mm')}`} // Show time on hover
        />
      )}
    </div>
  );
}

