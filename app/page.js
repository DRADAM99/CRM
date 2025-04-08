"use client";

// React and Hooks
import React, { useState, useEffect, useMemo, useCallback } from "react";

// UI Components (Shadcn/UI - ensure these are added to your project)
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Drag and Drop (dnd-kit)
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";

// Custom Components (Ensure these exist at the correct paths)
import SortableItem from "../components/ui/sortable-item"; // Wrapper for sortable elements
import DroppableCalendar from "../components/DroppableCalendar"; // Your calendar component wrapper

// Calendar (react-big-calendar and moment)
import moment from 'moment-timezone'; // Use moment-timezone if needed, otherwise just 'moment'
import 'moment/locale/he'; // Import Hebrew locale for moment
import { momentLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css'; // Default R-B-C styles

// --- Helper Functions (Defined outside the component) ---

/**
 * Formats a Date object or date string into a Hebrew locale string (Date + 24h Time).
 * @param {Date | string | null | undefined} date - The date to format.
 * @returns {string} - The formatted date-time string or "" if input is invalid.
 */
const formatDateTime = (date) => {
  if (!date) return "";
  try {
    const d = new Date(date);
    // Check if the date is valid after parsing
    if (isNaN(d.getTime())) {
        return "";
    }
    // Format using Hebrew locale, DD/MM/YYYY HH:MM (24-hour)
    return `${d.toLocaleDateString("he-IL")} ${d.toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false, // Ensure 24-hour format
    })}`;
  } catch (error) {
    console.error("Error formatting date:", date, error);
    return ""; // Return empty string on error
  }
};

// --- Initialize Calendar Localizer ---
// Set moment locale globally (optional, but good practice if app is primarily Hebrew)
moment.locale('he');
// Set default timezone if using moment-timezone
moment.tz.setDefault("Asia/Jerusalem"); // Ensure this matches your import if using timezone features
// Create the localizer instance for react-big-calendar
const localizer = momentLocalizer(moment);

// --- Define Hebrew messages for the calendar ---
// THIS is the definition that might be missing or misplaced in your file
const messages = {
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


// --- Define Lead Status Mapping (Outside component for clarity) ---
const leadStatusConfig = {
  "חדש": { color: "bg-red-500", priority: 1 },
  "מעקב": { color: "bg-orange-500", priority: 2 },
  "ממתין ליעוץ עם אדם": { color: "bg-purple-500", priority: 3 },
  "באג": { color: "bg-yellow-900", priority: 4 },
  "לא מתאים": { color: "bg-yellow-900", priority: 4 },
  "אין מענה": { color: "bg-yellow-900", priority: 4 },
  "תור נקבע": { color: "bg-green-500", priority: 5 },
  "Default": { color: "bg-gray-300", priority: 6 }
};

// Helper function to get lead status color
const leadColorTab = (status) => leadStatusConfig[status]?.color || leadStatusConfig.Default.color;

// Helper function to get lead status priority value
const leadPriorityValue = (status) => leadStatusConfig[status]?.priority || leadStatusConfig.Default.priority;

// --- Define Task Categories (Outside component for easy modification) ---
const taskCategories = ["לקבוע סדרה", "דוחות", "תשלומים", "להתקשר", "אדם", "אחר"]; // Added 'אחר' as a default/fallback

// ========================================================================
// Dashboard Component Definition
// ========================================================================
export default function Dashboard() {
  // ---------------------------\
  // General & Layout State
  // ---------------------------
  const [selectedDate, setSelectedDate] = useState(new Date()); // Currently selected date in the calendar
  const [view, setView] = useState("month"); // Calendar view: 'month', 'week', 'day'
  const [isFullView, setIsFullView] = useState(false); // Leads full/compact view toggle
  const [mounted, setMounted] = useState(false); // Flag to ensure component is mounted before using localStorage etc.

  // Layout order state
  const defaultBlockOrder = { TM: 1, Calendar: 2, Leads: 3 }; // Default order: TM, Calendar, Leads
  const [blockOrder, setBlockOrder] = useState(defaultBlockOrder);

  // ---------------------------\
  // Modals State
  // ---------------------------
  // NLP Task Modal
  const [showNLPModal, setShowNLPModal] = useState(false); // Visibility state for NLP task input modal
  const [nlpInput, setNlpInput] = useState(""); // Input value for NLP task creation

  // Return Task Modal
  const [showReturnModal, setShowReturnModal] = useState(false); // Visibility state for return task modal
  const [returnTaskId, setReturnTaskId] = useState(null); // ID of the task being returned
  const [returnComment, setReturnComment] = useState(""); // Comment for the returned task
  const [returnNewAssignee, setReturnNewAssignee] = useState(""); // New assignee for the returned task

  // Task History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false); // Visibility state for completed tasks history modal

  // ---------------------------\
  // Task Manager State
  // ---------------------------
  const [tasks, setTasks] = useState([
    // Sample tasks - Replace with data fetching later
    {
      id: 'task-1', // Use string IDs for easier dnd-kit handling
      assignTo: "עצמי",
      title: "משימה 1 - לקבוע סדרה",
      subtitle: "תיאור משימה 1",
      priority: "רגיל",
      category: "לקבוע סדרה",
      dueDate: new Date(new Date().setDate(new Date().getDate() + 1)), // Tomorrow
      done: false,
      completedBy: null,
      completedAt: null,
    },
    {
      id: 'task-2',
      assignTo: "עצמי",
      title: "משימה 2 - דוחות (בוצעה)",
      subtitle: "תיאור משימה 2",
      priority: "רגיל",
      category: "דוחות",
      dueDate: new Date(new Date().setDate(new Date().getDate() - 1)), // Yesterday
      done: true,
      completedBy: "CurrentUser", // Placeholder for actual user
      completedAt: new Date(new Date().setDate(new Date().getDate() - 1)), // Yesterday
    },
    {
      id: 'task-3',
      assignTo: "משתמש אחר",
      title: "משימה 3 - תשלומים (דחופה)",
      subtitle: "תיאור משימה 3",
      priority: "דחוף",
      category: "תשלומים",
      dueDate: new Date(), // Today
      done: false,
      completedBy: null,
      completedAt: null,
    },
    {
      id: 'task-4',
      assignTo: "אדם",
      title: "משימה 4 - להתקשר",
      subtitle: "משימה עבור אדם",
      priority: "רגיל",
      category: "להתקשר",
      dueDate: new Date(new Date().setDate(new Date().getDate() + 2)), // Day after tomorrow
      done: false,
      completedBy: null,
      completedAt: null,
    },
     {
      id: 'task-5',
      assignTo: "עצמי",
      title: "משימה 5 - אדם",
      subtitle: "תיאור משימה 5 לאדם",
      priority: "נמוך",
      category: "אדם",
      dueDate: new Date(new Date().setDate(new Date().getDate() + 5)), // In 5 days
      done: false,
      completedBy: null,
      completedAt: null,
    },
     {
      id: 'task-6',
      assignTo: "עצמי",
      title: "משימה 6 - אחר",
      subtitle: "תיאור משימה 6",
      priority: "רגיל",
      category: "אחר",
      dueDate: new Date(new Date().setDate(new Date().getDate() + 3)), // In 3 days
      done: false,
      completedBy: null,
      completedAt: null,
    },
  ]);

  // Task Filtering & Display State
  const [taskFilter, setTaskFilter] = useState("הכל"); // Filter: 'הכל', 'שלי', 'אחרים'
  // Defaulting Task Manager view to compact list
  const [isTMFullView, setIsTMFullView] = useState(false); // Task Manager full/compact view toggle
  const [showDoneTasks, setShowDoneTasks] = useState(false); // Toggle visibility of completed tasks

  // Task Editing State (populated when editing starts)
  const [editingTaskId, setEditingTaskId] = useState(null); // ID of task currently being edited
  const [editingAssignTo, setEditingAssignTo] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [editingSubtitle, setEditingSubtitle] = useState("");
  const [editingPriority, setEditingPriority] = useState("רגיל");
  const [editingCategory, setEditingCategory] = useState(taskCategories[0]); // Default to first category
  const [editingDueDate, setEditingDueDate] = useState(""); // Format: YYYY-MM-DD
  const [editingDueTime, setEditingDueTime] = useState(""); // Format: HH:MM

  // ---------------------------\
  // Leads State
  // ---------------------------
  const [leads, setLeads] = useState([
    // Sample leads - Replace with data fetching later
    {
      id: 'lead-1', // Use string IDs
      createdAt: new Date(),
      fullName: "יוסי כהן",
      phoneNumber: "0501234567",
      message: "פולו-אפ על פגישה",
      status: "חדש",
      source: "פייסבוק",
      conversationSummary: [
        { text: "יצירת קשר ראשונית, תיאום פגישה.", timestamp: new Date() },
      ],
      expanded: false, // For controlling detailed view expansion
    },
    {
      id: 'lead-2',
      createdAt: new Date("2025-03-30T14:00:00"), // Use specific time
      fullName: "שרה מזרחי",
      phoneNumber: "0527654321",
      message: "שיחת בירור מצב",
      status: "מעקב",
      source: "מבצע טלמרקטינג",
      conversationSummary: [
        { text: "שוחחנו על המצב, תיאום שיחה נוספת.", timestamp: new Date("2025-03-30T14:05:00") },
      ],
      expanded: false,
    },
    {
      id: 'lead-3',
      createdAt: new Date("2025-04-01T10:30:00"),
      fullName: "בני גנץ",
      phoneNumber: "0509876543",
      message: "לא היה מענה",
      status: "אין מענה",
      source: "אתר אינטרנט",
      conversationSummary: [
        { text: "ניסיתי להתקשר, אין מענה.", timestamp: new Date("2025-04-01T10:30:00") },
      ],
      expanded: false,
    },
     {
      id: 'lead-4',
      createdAt: new Date("2025-04-05T16:15:00"),
      fullName: "דנה לוי",
      phoneNumber: "0541122334",
      message: "קבעה פגישה לשבוע הבא",
      status: "תור נקבע",
      source: "המלצה",
      conversationSummary: [
         { text: "שיחה ראשונית, עניין רב.", timestamp: new Date("2025-04-05T16:00:00") },
         { text: "נקבעה פגישת ייעוץ ל-15/4.", timestamp: new Date("2025-04-05T16:15:00") },
      ],
      expanded: false,
    },
  ]);

  // Leads Editing State (populated when editing starts)
  const [editingLeadId, setEditingLeadId] = useState(null); // ID of lead currently being edited
  const [editLeadFullName, setEditLeadFullName] = useState("");
  const [editLeadPhone, setEditLeadPhone] = useState("");
  const [editLeadMessage, setEditLeadMessage] = useState("");
  const [editLeadStatus, setEditLeadStatus] = useState("חדש");
  const [editLeadSource, setEditLeadSource] = useState("");
  const [editLeadNLP, setEditLeadNLP] = useState(""); // NLP input within lead edit form
  const [newConversationText, setNewConversationText] = useState(""); // Input for adding new conversation entry
  const [showConvUpdate, setShowConvUpdate] = useState(null); // Controls visibility of conversation add input for a specific lead ID

  // Leads Sort & Filter State
  const [leadSortBy, setLeadSortBy] = useState("priority"); // Sort criteria: "priority" | "date"
  const [leadTimeFilter, setLeadTimeFilter] = useState("all"); // Time filter: "all" | "week" | "month" | "custom"
  const [leadFilterFrom, setLeadFilterFrom] = useState(""); // Custom date range 'from'
  const [leadFilterTo, setLeadFilterTo] = useState(""); // Custom date range 'to'

  // ---------------------------\
  // Drag & Drop State
  // ---------------------------
  const [activeId, setActiveId] = useState(null); // ID of the item currently being dragged
  // State for prefilling category via '+' button in Kanban
  const [prefillCategory, setPrefillCategory] = useState(null);
  // State to track if user manually sorted the compact task list
  const [userHasSortedTasks, setUserHasSortedTasks] = useState(false);

  // Define sensors for dnd-kit (Pointer and Keyboard)
  // Configure PointerSensor to prevent drag activation on specific elements
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // Require pointer to move this distance before activating drag (adjust as needed)
        distance: 5,
        // Check if the event target is inside an interactive element
        // Note: Adjust selector as needed for your specific interactive elements
        shouldActivate: (event, { nativeEvent }) => {
          const target = nativeEvent.target;
          // Don't activate drag if clicking on input, button, label, or anchor tags
          // Added 'span' inside button as sometimes the click target is the inner span
          if (target.closest('input, button, label, a, span')) {
             // Specifically allow drag if the target *is* the draggable item itself or has cursor-grab
             // This check might need refinement based on your exact task item structure
             // Allow clicks on edit button or links without starting drag
             if (target.closest('[role="button"]')?.ariaLabel?.includes('Edit task') || target.closest('a')) {
                 return false;
             }
             // Prevent drag start on checkbox specifically
             if (target.closest('input[type="checkbox"]')) {
                 return false;
             }
             // If it's generally inside a button/input/label not handled above, prevent drag
             if (target.closest('input, button, label')) {
                 // Exception: Allow drag if clicking directly on the sortable item's div (e.g., the background)
                 // This check assumes SortableItem renders a div with role="button" implicitly via attributes/listeners
                 // If SortableItem's root is different, adjust this check
                 if (target.closest('[role="button"]') === target) {
                    // Check if it's the main sortable container (might need a specific data attribute)
                    // For now, assume if it's role=button and not handled above, it might be the drag area
                    // return true; // Or let the default handle it
                 } else {
                    return false; // It's inside a button/input/label, prevent drag
                 }
             }
          }
          return true; // Allow activation otherwise (e.g., clicking task background)
        }
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // (useEffect hooks and functions will go in the next sections)

  // ---------------------------\
  // Effects
  // ---------------------------

  // Effect runs once after initial render
  useEffect(() => {
    // Set mounted state to true. This prevents hydration errors with localStorage.
    setMounted(true);

    // Load saved layout order from localStorage
    const savedOrder = localStorage.getItem("dashboardBlockOrder");
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder);
        // Basic validation to ensure it has the expected keys
        if (parsedOrder.TM && parsedOrder.Calendar && parsedOrder.Leads) {
          setBlockOrder(parsedOrder);
        } else {
           console.warn("Invalid block order found in localStorage, using default.");
           localStorage.removeItem("dashboardBlockOrder"); // Clear invalid data
        }
      } catch (error) {
        console.error("Failed to parse dashboard block order from localStorage:", error);
        localStorage.removeItem("dashboardBlockOrder"); // Clear corrupted data
      }
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  // ---------------------------\
  // Layout Functions
  // ---------------------------

  /**
   * Toggles the display order of a dashboard block (TM, Calendar, Leads).
   * Cycles through positions 1 -> 2 -> 3 -> 1, handling swaps correctly.
   * Saves the new order to localStorage.
   * @param {'TM' | 'Calendar' | 'Leads'} key - The key of the block to reorder.
   */
  const toggleBlockOrder = useCallback((key) => {
    setBlockOrder((prevOrder) => {
      // Simple cycle: 1 -> 2 -> 3 -> 1
      const currentPosition = prevOrder[key];
      const newPosition = currentPosition === 3 ? 1 : currentPosition + 1;

      // Ensure no two blocks have the same order number after cycling
      // Find the key that currently has the newPosition we want to assign
      const keyToSwap = Object.keys(prevOrder).find(k => prevOrder[k] === newPosition);

      const newOrder = {
        ...prevOrder,
        [key]: newPosition, // Assign the new position to the clicked block
      };

      // If another block already had that position, give it the old position of the clicked block
      if (keyToSwap && keyToSwap !== key) {
          newOrder[keyToSwap] = currentPosition;
      }


      // Save to localStorage only if component is mounted (to avoid SSR issues)
      if (mounted) {
        localStorage.setItem("dashboardBlockOrder", JSON.stringify(newOrder));
      }
      return newOrder;
    });
  }, [mounted]); // Dependency: mounted state

  // (Task Manager, Leads, and Drag & Drop functions will go in the next section)
  // (Memoized calculations for filtered/sorted lists will also go there)

  // ---------------------------\
  // Task Manager Functions
  // ---------------------------

  /**
   * Parses task details (category, due date, time) from natural language input.
   * @param {string} text - The natural language input string.
   * @returns {object} - A partial task object with extracted details.
   */
  const parseTaskFromText = useCallback((text) => {
    // Attempt to find a category keyword first
    let category = taskCategories.find(cat => text.toLowerCase().includes(cat.toLowerCase())) || "אחר"; // Find category or default to 'Other'
    let dueDate = new Date(); // Default due date (today)
    let dueTime = "13:00"; // Default time

    // Basic date parsing (add more sophisticated logic if needed)
    if (text.includes("מחר")) {
      dueDate.setDate(dueDate.getDate() + 1);
    } else if (text.includes("מחרתיים")) {
        dueDate.setDate(dueDate.getDate() + 2);
    }
    // Look for specific dates like DD/MM or DD.MM
     const dateMatch = text.match(/(\d{1,2})[./](\d{1,2})/);
     if (dateMatch) {
         const day = parseInt(dateMatch[1], 10);
         const month = parseInt(dateMatch[2], 10) - 1; // Month is 0-indexed
         const currentYear = new Date().getFullYear();
         // Handle year rollover if the date is in the past relative to today
         const potentialDate = new Date(currentYear, month, day);
         if (potentialDate < new Date() && !text.match(/(\d{4})/)) { // If date is past and no year specified
            dueDate.setFullYear(currentYear + 1, month, day);
         } else {
            dueDate.setFullYear(currentYear, month, day);
         }
     }


    // Basic time parsing
    const timeMatch = text.match(/(?:בשעה|ב)\s*(\d{1,2}):(\d{2})/); // Matches "בשעה HH:MM" or "בHH:MM"
    if (timeMatch) {
      dueTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
    } else {
       const singleHourMatch = text.match(/(?:בשעה|ב)\s*(\d{1,2})(?!\d|:)/); // Matches "בשעה H" or "בH" (no minutes)
        if (singleHourMatch) {
            dueTime = `${singleHourMatch[1].padStart(2, '0')}:00`;
        }
    }


    const [hours, minutes] = dueTime.split(":").map(Number);
    dueDate.setHours(hours, minutes, 0, 0);

    // Extract title by removing date/time/category keywords (simple approach)
    let title = text
        .replace(/מחרתיים|מחר/g, '')
        .replace(/(?:בשעה|ב)\s*(\d{1,2}):?(\d{2})?/g, '')
        .replace(/(\d{1,2})[./](\d{1,2})(?:[./](\d{4}|\d{2}))?/g,'')
        // Avoid removing category if it's the only word
        .replace(new RegExp(`\\b(${taskCategories.join('|')})\\b`, 'gi'), (match, p1, offset, string) => string.trim() === match ? match : '')
        .trim();
    // If title is empty after replacements, use original text
    if (!title) {
        title = text;
    }


    return {
      // id will be generated when adding
      assignTo: "עצמי", // Default assignee
      title: title,
      subtitle: "", // Empty subtitle initially
      priority: "רגיל", // Default priority
      category,
      dueDate,
      done: false,
      completedBy: null,
      completedAt: null,
    };
  }, []); // No dependencies, function is pure based on input text

  /**
   * Handles submission of the NLP task form.
   * Parses input, creates a new task (using prefilled category if available),
   * adds it to state, and closes the modal.
   * @param {React.FormEvent} e - The form submission event.
   */
  const handleNLPSubmit = useCallback((e) => {
    e.preventDefault();
    if (!nlpInput.trim()) return; // Ignore empty input

    // Use prefilled category if available, otherwise parse from text
    const parsedDetails = parseTaskFromText(nlpInput); // Still parse for date/time/title
    const finalCategory = prefillCategory || parsedDetails.category; // Use prefilled or parsed category

    const newTask = {
      ...parsedDetails,
      category: finalCategory, // Use the determined category
      id: `task-${Date.now()}`, // Generate unique ID
    };
    setTasks((prevTasks) => [...prevTasks, newTask]);
    setNlpInput(""); // Clear input
    setShowNLPModal(false); // Close modal
    setPrefillCategory(null); // Reset prefill category
  }, [nlpInput, parseTaskFromText, prefillCategory]); // Dependencies: nlpInput, parser, and prefillCategory

  /**
   * Toggles the completion status of a task and records completion info.
   * @param {string} id - The ID of the task to toggle.
   */
  const toggleTaskDone = useCallback((id) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) => {
        if (task.id === id) {
          const isNowDone = !task.done;
          console.log(`Toggling task ${id} to done=${isNowDone}`); // Debug log
          return {
            ...task,
            done: isNowDone,
            completedBy: isNowDone ? "CurrentUser" : null, // Replace "CurrentUser" with actual user logic later
            completedAt: isNowDone ? new Date() : null,
          };
        }
        return task;
      })
    );
  }, []); // Dependency: setTasks (implicitly stable)

  /**
   * Populates the editing form state when the user clicks the edit button on a task.
   * @param {object | null} task - The task object to edit, or null if not found.
   */
  const handleEditTask = useCallback((task) => {
    if (!task) {
        console.error("handleEditTask called with null task");
        setEditingTaskId(null); // Ensure editing mode is exited if task is invalid
        return;
    }
    console.log(`Editing task: ${task.id}`); // Debug log
    setEditingTaskId(task.id);
    setEditingAssignTo(task.assignTo);
    setEditingTitle(task.title);
    setEditingSubtitle(task.subtitle || ""); // Handle potential null/undefined subtitle
    setEditingPriority(task.priority);
    setEditingCategory(task.category);

    try {
        const due = new Date(task.dueDate);
         if (isNaN(due.getTime())) throw new Error("Invalid date object");
        // Format date and time for input fields (YYYY-MM-DD and HH:MM)
        setEditingDueDate(due.toISOString().split("T")[0]);
        setEditingDueTime(due.toTimeString().split(" ")[0].slice(0, 5));
    } catch (error) {
        console.error("Error processing task due date for editing:", task.dueDate, error);
        // Set defaults or handle error state appropriately
        setEditingDueDate("");
        setEditingDueTime("");
    }
  }, []); // Dependency: setEditing... state setters (implicitly stable)

  /**
   * Saves the edited task details back to the main tasks state.
   * Combines date and time inputs into a Date object.
   * @param {React.FormEvent} e - The form submission event.
   */
  const handleSaveTask = useCallback((e) => {
    e.preventDefault();
    if (!editingTaskId) return; // Should not happen if form is visible, but good practice

    let dueDateTime;
    try {
        // Combine date and time strings into a Date object
        // Default time to 00:00 if time input is empty
        const timeString = editingDueTime || "00:00";
        // Ensure date string is valid before creating Date
        if (!editingDueDate || typeof editingDueDate !== 'string' || !editingDueDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            throw new Error("Invalid date format");
        }
        dueDateTime = new Date(`${editingDueDate}T${timeString}:00`);
        if (isNaN(dueDateTime.getTime())) throw new Error("Invalid combined date/time");
    } catch (error) {
        console.error("Error creating due date from inputs:", editingDueDate, editingDueTime, error);
        // Optionally: show an error to the user, prevent saving, or use a default date
        // For now, we'll proceed but the date might be invalid
        dueDateTime = new Date(); // Fallback to now, consider better handling
    }


    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === editingTaskId
          ? {
              ...task,
              assignTo: editingAssignTo,
              title: editingTitle,
              subtitle: editingSubtitle,
              priority: editingPriority,
              category: editingCategory,
              dueDate: dueDateTime,
            }
          : task
      )
    );
    setEditingTaskId(null); // Exit editing mode
     // Clear editing form fields (optional, good practice)
     setEditingAssignTo("");
     setEditingTitle("");
     setEditingSubtitle("");
     setEditingPriority("רגיל");
     setEditingCategory(taskCategories[0]);
     setEditingDueDate("");
     setEditingDueTime("");
  }, [
      editingTaskId, editingAssignTo, editingTitle, editingSubtitle,
      editingPriority, editingCategory, editingDueDate, editingDueTime
  ]); // Dependencies: all editing state variables

  /**
   * Cancels the task editing process and clears the editing form state.
   */
  const handleCancelEdit = useCallback(() => {
    setEditingTaskId(null); // Exit editing mode
     // Clear editing form fields
     setEditingAssignTo("");
     setEditingTitle("");
     setEditingSubtitle("");
     setEditingPriority("רגיל");
     setEditingCategory(taskCategories[0]);
     setEditingDueDate("");
     setEditingDueTime("");
  }, []); // No dependencies needed

  /**
   * Handles submission of the "Return Task" modal.
   * (Placeholder - needs actual implementation logic).
   * @param {React.FormEvent} e - The form submission event.
   */
  const handleReturnSubmit = useCallback((e) => {
    e.preventDefault();
    if (!returnTaskId) return;
    console.log("Returning task:", returnTaskId, "to:", returnNewAssignee, "Comment:", returnComment);
    // TODO: Implement actual logic:
    // 1. Find the task by returnTaskId.
    // 2. Update its `assignTo` field to returnNewAssignee.
    // 3. Potentially add an entry to a task history/log with the comment.
    // 4. Notify the new assignee (if applicable).
    // Example state update (replace with actual logic):
    // setTasks(prev => prev.map(t => t.id === returnTaskId ? {...t, assignTo: returnNewAssignee} : t));

    // Close modal and clear state
    setShowReturnModal(false);
    setReturnComment("");
    setReturnNewAssignee("");
    setReturnTaskId(null);
  }, [returnTaskId, returnNewAssignee, returnComment]); // Dependencies: modal state variables

  // ---------------------------\
  // Leads Functions
  // ---------------------------

   /**
   * Checks if a lead's creation date falls within the selected time filter range.
   * @param {object} lead - The lead object.
   * @returns {boolean} - True if the lead is within the time range, false otherwise.
   */
  const isLeadInTimeRange = useCallback((lead) => {
    try {
        const created = new Date(lead.createdAt);
        if (isNaN(created.getTime())) return false; // Invalid date check

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (leadTimeFilter === "week") {
        const oneWeekAgo = new Date(todayStart);
        oneWeekAgo.setDate(todayStart.getDate() - 7);
        return created >= oneWeekAgo;
        } else if (leadTimeFilter === "month") {
        const oneMonthAgo = new Date(todayStart);
        oneMonthAgo.setMonth(todayStart.getMonth() - 1);
        return created >= oneMonthAgo;
        } else if (leadTimeFilter === "custom") {
        let inRange = true;
        if (leadFilterFrom) {
            const fromDate = new Date(leadFilterFrom);
            fromDate.setHours(0, 0, 0, 0); // Start of the 'from' day
             if (isNaN(fromDate.getTime())) { /* handle invalid date */ }
             else if (created < fromDate) inRange = false;
        }
        if (leadFilterTo) {
            const toDate = new Date(leadFilterTo);
            toDate.setHours(23, 59, 59, 999); // End of the 'to' day
             if (isNaN(toDate.getTime())) { /* handle invalid date */ }
             else if (created > toDate) inRange = false;
        }
        return inRange;
        } else {
        // "all"
        return true;
        }
    } catch (error) {
        console.error("Error checking lead time range:", lead, error);
        return false; // Exclude lead if error occurs
    }
  }, [leadTimeFilter, leadFilterFrom, leadFilterTo]); // Dependencies: filter state

  /**
   * Comparison function for sorting leads based on selected criteria (priority or date).
   * @param {object} a - First lead object.
   * @param {object} b - Second lead object.
   * @returns {number} - Sorting order (-1, 0, 1).
   */
  const compareLeads = useCallback((a, b) => {
    if (leadSortBy === "priority") {
      // Sort by priority value (ascending, lower number = higher priority)
      // Then by date ascending as a tie-breaker
      const priorityDiff = leadPriorityValue(a.status) - leadPriorityValue(b.status);
      if (priorityDiff !== 0) return priorityDiff;
      try {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } catch(e) { return 0; }
    } else {
      // Sort by creation date ascending (oldest first)
      try {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } catch(e) { return 0; }
    }
  }, [leadSortBy]); // Dependency: sort criteria state

  /**
   * Sets state variables to start editing a specific lead and expands its view.
   * @param {object} lead - The lead object to edit.
   */
  const handleEditLead = useCallback((lead) => {
    if (!lead) return;
    setEditingLeadId(lead.id);
    setEditLeadFullName(lead.fullName);
    setEditLeadPhone(lead.phoneNumber);
    setEditLeadMessage(lead.message);
    setEditLeadStatus(lead.status);
    setEditLeadSource(lead.source || "");
    setEditLeadNLP(""); // Clear NLP field when starting edit
    setNewConversationText(""); // Clear conversation field
    // Expand the lead being edited and collapse others (optional)
    setLeads((prevLeads) =>
      prevLeads.map((l) => ({
          ...l,
          expanded: l.id === lead.id // Expand only the selected lead
      }))
    );
  }, []); // Dependencies: state setters (implicitly stable)

  /**
   * Creates a follow-up task based on NLP input within the lead editing form.
   * @param {string} leadId - The ID of the lead the task is related to.
   */
  const handleLeadNLPSubmit = useCallback((leadId) => {
    if (!editLeadNLP.trim()) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    // Use the task parsing logic, but adapt title/assignee
    const parsedDetails = parseTaskFromText(editLeadNLP);

    const newTask = {
      ...parsedDetails, // Use parsed date, category etc.
      id: `task-${Date.now()}`,
      assignTo: "עצמי", // Default to self, or could be adapted
      title: `מעקב ${lead.fullName}: ${parsedDetails.title}`, // Enhance title
      subtitle: editLeadNLP, // Keep original NLP as subtitle maybe?
      // priority: 'דחוף', // Maybe default follow-ups to high priority?
    };
    setTasks((prevTasks) => [...prevTasks, newTask]);
    setEditLeadNLP(""); // Clear NLP input in the lead form
  }, [editLeadNLP, leads, parseTaskFromText]); // Dependencies: lead NLP input, leads list, parser

  /**
   * Saves the edited lead details back to the main leads state.
   * @param {React.FormEvent} e - The form submission event.
   * @param {string} leadId - The ID of the lead being saved.
   */
  const handleSaveLead = useCallback((e, leadId) => {
    e.preventDefault();
    setLeads((prevLeads) =>
      prevLeads.map((l) => {
        if (l.id === leadId) {
          return {
            ...l,
            fullName: editLeadFullName,
            phoneNumber: editLeadPhone,
            message: editLeadMessage,
            status: editLeadStatus,
            source: editLeadSource,
            expanded: false, // Collapse after saving
          };
        }
        return l;
      })
    );
    setEditingLeadId(null); // Exit editing mode
  }, [
      editLeadFullName, editLeadPhone, editLeadMessage,
      editLeadStatus, editLeadSource
  ]); // Dependencies: lead editing form state

  /**
   * Collapses a lead's detailed/editing view.
   * @param {string} leadId - The ID of the lead to collapse.
   */
  const handleCollapseLead = useCallback((leadId) => {
    setLeads((prevLeads) =>
      prevLeads.map((l) => (l.id === leadId ? { ...l, expanded: false } : l))
    );
    // If this was the lead being edited, exit editing mode
    if (editingLeadId === leadId) {
      setEditingLeadId(null);
    }
  }, [editingLeadId]); // Dependency: editingLeadId

  /**
   * Adds a new entry to a lead's conversation summary.
   * @param {string} leadId - The ID of the lead to add the conversation entry to.
   */
  const handleAddConversation = useCallback((leadId) => {
    if (!newConversationText.trim()) return;
    setLeads((prevLeads) =>
      prevLeads.map((l) => {
        if (l.id === leadId) {
          const newEntry = {
            text: newConversationText,
            timestamp: new Date(),
          };
          // Add new entry to the beginning of the summary array
          const updatedSummaries = [newEntry, ...(l.conversationSummary || [])];
          return { ...l, conversationSummary: updatedSummaries };
        }
        return l;
      })
    );
    setNewConversationText(""); // Clear input field
    // Keep the conversation input area visible after adding
    setShowConvUpdate(leadId);
  }, [newConversationText]); // Dependency: new conversation text state

  // ---------------------------\
  // Memoized Calculations (Derived State)
  // ---------------------------

  // Memoize the filtered and potentially sorted tasks list
  const sortedAndFilteredTasks = useMemo(() => {
    console.log("Recalculating sortedAndFilteredTasks"); // Debug log
    // Start with filtering
    let filtered = tasks.filter((task) => {
        // Apply assignee filter
        const assigneeMatch =
          taskFilter === "הכל" ||
          (taskFilter === "שלי" && task.assignTo === "עצמי") ||
          (taskFilter === "אחרים" && task.assignTo !== "עצמי");

        // Apply 'showDoneTasks' filter
        const doneMatch = showDoneTasks || !task.done;

        return assigneeMatch && doneMatch;
      });

    // Apply sorting UNLESS user has manually sorted the compact view
    if (!userHasSortedTasks || isTMFullView) { // Sort if in Kanban OR if user hasn't sorted compact view
        console.log("Applying default sort to tasks");
        filtered = filtered.sort((a, b) => {
            // Sort logic:
            // 1. Not done tasks first
            if (a.done !== b.done) {
              return a.done ? 1 : -1; // Done tasks go to the bottom
            }
            // 2. If both have same 'done' status, sort by due date (ascending - earliest first)
            try {
                 // Add safety check for valid dates before comparison
                 const dateA = new Date(a.dueDate);
                 const dateB = new Date(b.dueDate);
                 if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0; // Don't sort invalid dates relative to others
                 return dateA.getTime() - dateB.getTime();
            } catch(e) { return 0; } // Handle potential errors during date parsing/comparison
        });
    } else {
        console.log("Skipping default sort, preserving user order for compact view");
    }

    return filtered; // Return the filtered (and potentially sorted) array
  }, [tasks, taskFilter, showDoneTasks, userHasSortedTasks, isTMFullView]); // Dependencies: Added userHasSortedTasks, isTMFullView

  // Memoize the events array for the calendar component
  const events = useMemo(() => {
     console.log("Recalculating events for calendar"); // Debug log
    return tasks.map((t) => {
         let start, end;
         try {
             start = new Date(t.dueDate);
             // Set a default end time (e.g., 1 hour after start)
             // Adjust if your tasks have duration or specific end times
             end = new Date(start.getTime() + 60 * 60 * 1000);
             if (isNaN(start.getTime())) throw new Error("Invalid start date");
         } catch (error) {
             console.error("Invalid date for task, cannot create calendar event:", t.id, t.dueDate, error);
             // Skip this task or provide default dates
             start = new Date(); // Default to now
             end = new Date(start.getTime() + 60 * 60 * 1000);
             // Optionally return null to filter it out later
             // return null;
         }

        return {
            id: t.id, // Use task id
            title: t.title,
            start: start,
            end: end,
            allDay: false, // Determine based on task properties if needed
            resource: t.category, // Optional: Use category as resource
            isDone: t.done, // Pass done status for potential styling
        };
    }).filter(event => event !== null); // Filter out any skipped tasks
  }, [tasks]); // Dependency: tasks array

  // Memoize the filtered and sorted leads list
  const leadsSorted = useMemo(() => {
     console.log("Recalculating leadsSorted"); // Debug log
    return leads.filter(isLeadInTimeRange).sort(compareLeads);
  }, [leads, leadSortBy, leadTimeFilter, leadFilterFrom, leadFilterTo, isLeadInTimeRange, compareLeads]); // Dependencies: leads array, filters, sort functions

  // ---------------------------\
  // Drag & Drop Handlers
  // ---------------------------

   /**
   * Stores the ID of the item that started dragging.
   * Used for potential DragOverlay or identifying the item in handleDragEnd.
   * @param {object} event - The drag start event object from dnd-kit.
   */
  const handleDragStart = useCallback((event) => {
    console.log("Drag Start:", event.active.id); // Debug log
    setActiveId(event.active.id);
  }, []); // No dependencies needed

  /**
   * Handles the end of a drag operation (task reordering, task to calendar, task between columns).
   * @param {object} event - The drag end event object from dnd-kit.
   */
  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    console.log("Drag End:", active.id, "over", over?.id); // Debug log
    setActiveId(null); // Clear active drag item

    if (!over) {
      console.log("Dropped outside any droppable area.");
      return; // Dropped outside a valid target
    }

    const activeId = active.id;
    const overId = over.id;
    const activeTask = tasks.find(t => t.id === activeId);

    // Ensure activeId is valid and corresponds to a task
    if (!activeTask || !activeId || typeof activeId !== 'string' || !activeId.startsWith('task-')) {
        console.error("Dragged item is not a valid task or activeId is missing:", activeId);
        return;
    }


    // Case 1: Dropping onto the Calendar
    if (overId === "calendar-dropzone") {
      console.log(`Task ${activeId} dropped on Calendar (Date: ${selectedDate.toDateString()})`);
      const currentDueDate = new Date(activeTask.dueDate);
      const newDueDate = new Date(selectedDate);
      // Preserve original time if valid, otherwise maybe default?
      if (!isNaN(currentDueDate.getTime())) {
          newDueDate.setHours(
              currentDueDate.getHours(),
              currentDueDate.getMinutes(),
              0, 0 // Reset seconds/ms
          );
      } else {
          newDueDate.setHours(12, 0, 0, 0); // Default to noon if original time invalid
      }


      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === activeId ? { ...task, dueDate: newDueDate } : task
        )
      );
      // If user manually sorted compact view, dropping on calendar should maybe reset that? Optional.
      // setUserHasSortedTasks(false);
      return; // Stop processing here for calendar drop
    }


    // Case 2: Moving Task Between Kanban Columns (or reordering within a column/list)
    const overContainerId = over.data?.current?.sortable?.containerId; // ID of the column/container dropped onto
    const activeContainerId = active.data?.current?.sortable?.containerId; // ID of the column/container dragged from


    if (activeContainerId && overContainerId && activeContainerId !== overContainerId) {
      // --- Moving task to a different category column (Kanban View) ---
      console.log(`Moving task ${activeId} from column ${activeContainerId} to ${overContainerId}`);
      // Ensure the target category is valid
      if (taskCategories.includes(overContainerId)) {
          setTasks((prevTasks) =>
            prevTasks.map((task) =>
              task.id === activeId ? { ...task, category: overContainerId } : task
            )
          );
          // Moving between columns in Kanban might reset manual sort order if user switches back to compact? Optional.
          // setUserHasSortedTasks(false);
      } else {
           console.warn("Dropped onto invalid container ID:", overContainerId);
      }

    } else if (activeId !== overId) {
        // --- Reordering task within the same column (Kanban) or list (Compact) ---
        // Find indices in the *original* tasks array for stable reordering
        const oldIndex = tasks.findIndex((t) => t.id === activeId);
        // Find the index of the item being dropped over
        const newIndex = tasks.findIndex((t) => t.id === overId);

        if (oldIndex !== -1 && newIndex !== -1) {
            console.log(`Reordering task ${activeId} from index ${oldIndex} to ${newIndex}`);
            setTasks((items) => arrayMove(items, oldIndex, newIndex));
           // UPDATE: Set flag indicating user has manually sorted (only if not in Kanban view)
           if (!isTMFullView) {
               console.log("Setting userHasSortedTasks to true");
               setUserHasSortedTasks(true);
           }
        } else {
            console.warn("Could not find indices for reordering:", activeId, overId);
        }
    } else {
        console.log("Dropped task on itself or invalid target within tasks area.");
    }

  }, [tasks, selectedDate, isTMFullView]); // Dependencies: Added isTMFullView

    // ---------------------------\
  // JSX Rendering
  // ---------------------------

  // Avoid rendering until the component is mounted to prevent hydration mismatches, especially with localStorage
  if (!mounted) {
    // Optional: Render a loading indicator here instead of null
    return null;
  }

  // Find the task object currently being dragged (for DragOverlay)
  const activeTaskForOverlay = activeId ? tasks.find(task => task.id === activeId) : null;

  return (
    // DndContext wraps the entire draggable area
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Header section for Logo and Version */}
      <header dir="rtl" className="flex justify-between items-center p-4 border-b bg-white">
        {/* Version ID */}
        <span className="text-sm text-gray-500">
          Version 4.0
        </span>
        {/* Logo - Updated src to point to public folder */}
        <img
         // Use the path relative to the public folder root
         src="/logo.png"
         alt="Logo"
         className="h-10" // Adjust height as needed
         onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/120x40/eeeeee/aaaaaa?text=Logo+Error'; }} // Basic error handling
        />
      </header>

      {/* Main container with RTL direction and grid layout */}
      <div dir="rtl" className="grid grid-cols-12 gap-4 p-4 bg-gray-50 min-h-screen">

        {/* ========================== Task Manager Block ========================== */}
        <div
          style={{ order: blockOrder.TM }} // Dynamically set order based on state
          // Adjusted column spans for default and expanded states
          className={`col-span-12 transition-all duration-300 ease-in-out ${
            isTMFullView ? "lg:col-span-12" : "lg:col-span-4" // Default: 4/12, Expanded: 12/12
          }`}
        >
          <Card className="h-full flex flex-col"> {/* Ensure card takes full height */}
            <CardHeader>
              {/* Header Row 1: Title & Layout Toggle */}
              <div className="flex justify-between items-center mb-3">
                <CardTitle>מנהל משימות</CardTitle>
                <div className="flex items-center gap-2">
                     {/* Updated button text based on state */}
                     <Button variant="outline" size="sm" onClick={() => setIsTMFullView(!isTMFullView)} title={isTMFullView ? "תצוגה מוקטנת" : "תצוגה מלאה"}>
                        {isTMFullView ? "תצוגה מוקטנת" : "תצוגה מלאה"}
                     </Button>
                     <Button size="xs" onClick={() => toggleBlockOrder("TM")} title="שנה מיקום">
                        מיקום: {blockOrder.TM}
                     </Button>
                </div>
              </div>
              {/* Header Row 2: Filters & Actions */}
              <div className="flex flex-wrap justify-between items-center gap-2">
                 {/* Assignee Filters */}
                 <div className="flex space-x-2 space-x-reverse">
                   <Button variant={taskFilter === 'הכל' ? 'default' : 'outline'} size="sm" onClick={() => setTaskFilter('הכל')}>הכל</Button>
                   <Button variant={taskFilter === 'שלי' ? 'default' : 'outline'} size="sm" onClick={() => setTaskFilter('שלי')}>שלי</Button>
                   <Button variant={taskFilter === 'אחרים' ? 'default' : 'outline'} size="sm" onClick={() => setTaskFilter('אחרים')}>אחרים</Button>
                 </div>
                 {/* Action Buttons & Toggles */}
                 <div className="flex items-center space-x-2 space-x-reverse">
                    {/* Show/Hide Done Tasks Toggle */}
                    <div className="flex items-center space-x-1 space-x-reverse">
                        <Switch
                            id="show-done-tasks"
                            checked={showDoneTasks}
                            onCheckedChange={setShowDoneTasks}
                            aria-label="הצג משימות שבוצעו"
                        />
                        <Label htmlFor="show-done-tasks" className="text-sm cursor-pointer select-none">
                           הצג בוצעו
                        </Label>
                    </div>
                    {/* History Button */}
                    <Button variant="outline" size="sm" onClick={() => setShowHistoryModal(true)} title="היסטוריית משימות">
                        📜
                    </Button>
                    {/* Add Task via NLP Button */}
                    <Button size="sm" onClick={() => { setPrefillCategory(null); setNlpInput(""); setShowNLPModal(true); }}>+ משימה (NLP)</Button>
                 </div>
               </div>
            </CardHeader>
            <CardContent className="flex-grow overflow-hidden"> {/* Allow content to grow and handle overflow */}
              {/* Conditional Rendering: Kanban View or Compact List View */}
              {isTMFullView ? (
                // --- Kanban View ---
                <div className={`grid grid-cols-1 md:grid-cols-3 lg:grid-cols-${taskCategories.length} gap-3 h-[calc(100vh-270px)] overflow-x-auto`}> {/* Adjusted height for header */}
                  {taskCategories.map((category) => {
                    // Get tasks for the current category column
                    const categoryTasks = sortedAndFilteredTasks.filter(task => task.category === category);
                    return (
                      <div key={category} className="bg-gray-100 rounded-lg p-2 flex flex-col">
                         {/* Added flex container and Add button */}
                         <div className="flex justify-between items-center mb-2 sticky top-0 bg-gray-100 py-1 px-1 z-10"> {/* Added z-index */}
                             <h3 className="font-semibold text-center flex-grow">{category} ({categoryTasks.length})</h3>
                             <Button
                                 variant="ghost"
                                 size="icon"
                                 className="w-6 h-6 text-gray-500 hover:text-blue-600 shrink-0"
                                 onClick={() => {
                                     setPrefillCategory(category); // Set category to prefill
                                     setNlpInput(""); // Clear previous NLP input
                                     setShowNLPModal(true);      // Open modal
                                 }}
                                 title={`הוסף משימה ל${category}`}
                             >
                                 ➕
                             </Button>
                         </div>
                        <SortableContext
                          items={categoryTasks.map(t => t.id)} // IDs for this specific column
                          strategy={verticalListSortingStrategy}
                          id={category} // Use category name as the container ID for dnd logic
                        >
                          <ul className="space-y-3 flex-grow overflow-y-auto pr-1"> {/* Scroll within column */}
                            {categoryTasks.length === 0 && (
                              <li className="text-center text-gray-400 text-sm pt-4">אין משימות</li>
                            )}
                            {categoryTasks.map((task) => (
                              // Render Edit Form or Task Item
                              editingTaskId === task.id ? (
                                <li key={`edit-${task.id}`} className="p-3 border rounded bg-blue-50 shadow-md">
                                  {/* --- Task Editing Form --- */}
                                  <form onSubmit={handleSaveTask} className="space-y-2">
                                    {/* Assign To */}
                                    <div><Label className="text-xs">מוקצה ל:</Label><Input type="text" value={editingAssignTo} onChange={(e) => setEditingAssignTo(e.target.value)} className="h-8 text-sm" required /></div>
                                    {/* Title */}
                                    <div><Label className="text-xs">כותרת:</Label><Input type="text" value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} className="h-8 text-sm" required /></div>
                                    {/* Subtitle */}
                                    <div><Label className="text-xs">תיאור:</Label><Textarea value={editingSubtitle} onChange={(e) => setEditingSubtitle(e.target.value)} rows={2} className="text-sm" /></div>
                                    {/* Priority & Category (Category might be hidden/disabled here as it's defined by column) */}
                                    <div className="flex gap-2">
                                      <div className="flex-1"><Label className="text-xs">עדיפות:</Label>
                                        <Select value={editingPriority} onValueChange={setEditingPriority}>
                                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="בחר..." /></SelectTrigger>
                                          <SelectContent><SelectItem value="רגיל">רגיל</SelectItem><SelectItem value="דחוף">דחוף</SelectItem><SelectItem value="נמוך">נמוך</SelectItem></SelectContent>
                                        </Select>
                                      </div>
                                      {/* Optionally show category selector even in Kanban, or just display it */}
                                       <div className="flex-1"><Label className="text-xs">קטגוריה:</Label><Input type="text" value={editingCategory} readOnly disabled className="h-8 text-sm bg-gray-100"/></div>
                                    </div>
                                    {/* Due Date & Time */}
                                    <div className="flex gap-2">
                                      <div className="flex-1"><Label className="text-xs">תאריך:</Label><Input type="date" value={editingDueDate} onChange={(e) => setEditingDueDate(e.target.value)} className="h-8 text-sm" required /></div>
                                      <div className="flex-1"><Label className="text-xs">שעה:</Label><Input type="time" value={editingDueTime} onChange={(e) => setEditingDueTime(e.target.value)} className="h-8 text-sm" /></div>
                                    </div>
                                    {/* Action Buttons */}
                                    <div className="flex justify-end space-x-2 space-x-reverse pt-1">
                                      <Button type="submit" size="sm">שמור</Button>
                                      <Button type="button" variant="outline" size="sm" onClick={handleCancelEdit}>ביטול</Button>
                                    </div>
                                  </form>
                                </li>
                              ) : (
                                // --- Normal Task Item Display (Sortable) ---
                                <SortableItem key={task.id} id={task.id}>
                                  <div className={`p-2 border rounded shadow-sm cursor-grab active:cursor-grabbing ${task.done ? 'bg-gray-200 opacity-75' : 'bg-white'}`}>
                                    <div className="flex items-start space-x-3 space-x-reverse">
                                      {/* Checkbox with corrected handler (no 'e' or stopPropagation) */}
                                      <Checkbox
                                        checked={!!task.done}
                                        onCheckedChange={() => {
                                          console.log(`Checkbox clicked for task (Kanban): ${task.id}`); // Log that handler fired
                                          toggleTaskDone(task.id);
                                        }}
                                        id={`task-kanban-${task.id}`} // Unique ID per view
                                        className="mt-1 shrink-0"
                                        aria-label={`Mark task ${task.title} as ${task.done ? 'not done' : 'done'}`}
                                      />
                                      <div className="flex-grow overflow-hidden">
                                        <label htmlFor={`task-kanban-${task.id}`} className={`font-medium text-sm cursor-pointer ${task.done ? "line-through text-gray-500" : "text-gray-900"}`}>{task.title}</label>
                                        {task.subtitle && (<p className={`text-xs mt-0.5 ${task.done ? "line-through text-gray-400" : "text-gray-600"}`}>{task.subtitle}</p>)}
                                        <div className="text-xs text-gray-500 mt-1 space-x-2 space-x-reverse">
                                          <span>🗓️ {formatDateTime(task.dueDate)}</span>
                                          <span>👤 {task.assignTo}</span>
                                          {/* <span>🏷️ {task.category}</span> */} {/* Category is implied by column */}
                                          <span>{task.priority === 'דחוף' ? '🔥' : task.priority === 'נמוך' ? '⬇️' : '➖'} {task.priority}</span>
                                          {task.done && task.completedAt && (<span className="text-green-600">✅ {formatDateTime(task.completedAt)}</span>)}
                                        </div>
                                      </div>
                                      <Button variant="ghost" size="icon" className="w-6 h-6 shrink-0 text-gray-500 hover:text-blue-600" onClick={() => handleEditTask(task)} aria-label={`Edit task ${task.title}`}><span className="text-base">✎</span></Button>
                                    </div>
                                  </div>
                                </SortableItem>
                              )
                            ))}
                          </ul>
                        </SortableContext>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // --- Compact List View ---
                <SortableContext
                  items={sortedAndFilteredTasks.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="space-y-3 h-[calc(100vh-270px)] overflow-y-auto pr-2"> {/* Adjusted height for header */}
                    {sortedAndFilteredTasks.length === 0 && (
                      <li className="text-center text-gray-500 py-4">אין משימות להצגה</li>
                    )}
                    {sortedAndFilteredTasks.map((task) => (
                      // Render Edit Form or Task Item (Similar to Kanban but includes Category display)
                      editingTaskId === task.id ? (
                        <li key={`edit-${task.id}`} className="p-3 border rounded bg-blue-50 shadow-md">
                          {/* --- Task Editing Form (Compact View) --- */}
                           <form onSubmit={handleSaveTask} className="space-y-2">
                             {/* Assign To */}
                             <div><Label className="text-xs">מוקצה ל:</Label><Input type="text" value={editingAssignTo} onChange={(e) => setEditingAssignTo(e.target.value)} className="h-8 text-sm" required /></div>
                             {/* Title */}
                             <div><Label className="text-xs">כותרת:</Label><Input type="text" value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} className="h-8 text-sm" required /></div>
                             {/* Subtitle */}
                             <div><Label className="text-xs">תיאור:</Label><Textarea value={editingSubtitle} onChange={(e) => setEditingSubtitle(e.target.value)} rows={2} className="text-sm" /></div>
                             {/* Priority & Category */}
                             <div className="flex gap-2">
                               <div className="flex-1"><Label className="text-xs">עדיפות:</Label>
                                 <Select value={editingPriority} onValueChange={setEditingPriority}>
                                   <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="בחר..." /></SelectTrigger>
                                   <SelectContent><SelectItem value="רגיל">רגיל</SelectItem><SelectItem value="דחוף">דחוף</SelectItem><SelectItem value="נמוך">נמוך</SelectItem></SelectContent>
                                 </Select>
                               </div>
                               <div className="flex-1"><Label className="text-xs">קטגוריה:</Label>
                                 <Select value={editingCategory} onValueChange={setEditingCategory}>
                                     <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="בחר..." /></SelectTrigger>
                                     <SelectContent>{taskCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                                 </Select>
                               </div>
                             </div>
                             {/* Due Date & Time */}
                             <div className="flex gap-2">
                               <div className="flex-1"><Label className="text-xs">תאריך:</Label><Input type="date" value={editingDueDate} onChange={(e) => setEditingDueDate(e.target.value)} className="h-8 text-sm" required /></div>
                               <div className="flex-1"><Label className="text-xs">שעה:</Label><Input type="time" value={editingDueTime} onChange={(e) => setEditingDueTime(e.target.value)} className="h-8 text-sm" /></div>
                             </div>
                             {/* Action Buttons */}
                             <div className="flex justify-end space-x-2 space-x-reverse pt-1">
                               <Button type="submit" size="sm">שמור</Button>
                               <Button type="button" variant="outline" size="sm" onClick={handleCancelEdit}>ביטול</Button>
                             </div>
                           </form>
                        </li>
                      ) : (
                        // --- Normal Task Item Display (Compact View - Sortable) ---
                        <SortableItem key={task.id} id={task.id}>
                          <div className={`flex items-start space-x-3 space-x-reverse p-2 border rounded shadow-sm cursor-grab active:cursor-grabbing ${task.done ? 'bg-gray-100 opacity-70' : 'bg-white'}`}>
                            {/* Checkbox with corrected handler (no 'e' or stopPropagation) */}
                            <Checkbox
                                checked={!!task.done}
                                onCheckedChange={() => {
                                  console.log(`Checkbox clicked for task (Compact): ${task.id}`); // Log that handler fired
                                  toggleTaskDone(task.id);
                                }}
                                id={`task-compact-${task.id}`} // Unique ID per view
                                className="mt-1 shrink-0"
                                aria-label={`Mark task ${task.title} as ${task.done ? 'not done' : 'done'}`}
                            />
                            <div className="flex-grow overflow-hidden">
                              <label htmlFor={`task-compact-${task.id}`} className={`font-medium text-sm cursor-pointer ${task.done ? "line-through text-gray-500" : "text-gray-900"}`}>{task.title}</label>
                              {task.subtitle && (<p className={`text-xs mt-0.5 ${task.done ? "line-through text-gray-400" : "text-gray-600"}`}>{task.subtitle}</p>)}
                              <div className="text-xs text-gray-500 mt-1 space-x-2 space-x-reverse flex flex-wrap gap-x-2">
                                <span>🗓️ {formatDateTime(task.dueDate)}</span>
                                <span>👤 {task.assignTo}</span>
                                <span>🏷️ {task.category}</span> {/* Show category in list view */}
                                <span>{task.priority === 'דחוף' ? '🔥' : task.priority === 'נמוך' ? '⬇️' : '➖'} {task.priority}</span>
                                {task.done && task.completedAt && (<span className="text-green-600">✅ {formatDateTime(task.completedAt)}</span>)}
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" className="w-6 h-6 shrink-0 text-gray-500 hover:text-blue-600" onClick={() => handleEditTask(task)} aria-label={`Edit task ${task.title}`}><span className="text-base">✎</span></Button>
                          </div>
                        </SortableItem>
                      )
                    ))}
                  </ul>
                </SortableContext>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ========================== Calendar Block ========================== */}
        <div
          style={{ order: blockOrder.Calendar }} // Dynamic order
           // Adjusted column span
           className="col-span-12 lg:col-span-4" // Default: 4/12
        >
          <Card className="h-full flex flex-col"> {/* Ensure card takes full height */}
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>לוח שנה</CardTitle>
                <Button size="xs" onClick={() => toggleBlockOrder("Calendar")} title="שנה מיקום">
                  מיקום: {blockOrder.Calendar}
                </Button>
              </div>
               {/* Calendar Toolbar */}
               <div className="flex justify-between items-center mt-2 border-t pt-2">
                   <div className="flex gap-1">
                       <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())}>היום</Button>
                       <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => setSelectedDate(moment(selectedDate).subtract(1, view === 'month' ? 'month' : view === 'week' ? 'week' : 'day').toDate())}>&lt;</Button>
                       <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => setSelectedDate(moment(selectedDate).add(1, view === 'month' ? 'month' : view === 'week' ? 'week' : 'day').toDate())}>&gt;</Button>
                   </div>
                   <span className="font-semibold text-sm">
                       {moment(selectedDate).format(view === 'month' ? 'MMMM YYYY' : 'D MMMM YYYY')}
                   </span>
                   <div className="flex gap-1">
                       <Button variant={view === 'month' ? 'default' : 'outline'} size="sm" onClick={() => setView('month')}>חודש</Button>
                       <Button variant={view === 'week' ? 'default' : 'outline'} size="sm" onClick={() => setView('week')}>שבוע</Button>
                       <Button variant={view === 'day' ? 'default' : 'outline'} size="sm" onClick={() => setView('day')}>יום</Button>
                   </div>
               </div>
            </CardHeader>
            <CardContent className="flex-grow relative"> {/* Relative positioning for potential absolute elements inside calendar */}
              {/* Ensure DroppableCalendar takes available space */}
              {/* Adjusted height calculation slightly */}
              <div className="h-[calc(100vh-300px)] min-h-[400px]"> {/* Adjusted height for header */}
                  <DroppableCalendar
                    id="calendar-dropzone" // Crucial ID for dnd-kit drop detection
                    localizer={localizer} // Pass the moment localizer
                    events={events} // Pass the memoized events array
                    view={view} // Controlled view state
                    date={selectedDate} // Controlled date state
                    onNavigate={setSelectedDate} // Update date on calendar navigation
                    onView={setView} // Update view on calendar view change
                    onSelectEvent={event => handleEditTask(tasks.find(t => t.id === event.id))} // Edit task on event click
                    formats={{ // Use 24-hour format
                      timeGutterFormat: 'HH:mm',
                      eventTimeRangeFormat: ({ start, end }, culture, localizer) =>
                        localizer.format(start, 'HH:mm', culture) + ' - ' + localizer.format(end, 'HH:mm', culture),
                       agendaTimeRangeFormat: ({ start, end }, culture, localizer) => // Format for Agenda view
                        localizer.format(start, 'HH:mm', culture) + ' - ' + localizer.format(end, 'HH:mm', culture),
                       selectRangeFormat: ({ start, end }, culture, localizer) => // Format for selecting range
                        localizer.format(start, 'HH:mm', culture) + ' - ' + localizer.format(end, 'HH:mm', culture)
                    }}
                    messages={messages} // Hebrew messages
                    style={{ height: '100%' }} // Make calendar fill its container
                    className="rbc-calendar-rtl" // Add a class for potential RTL specific CSS overrides
                    // Add other necessary props for react-big-calendar
                    selectable={true} // Allow selecting time slots
                    // onSelectSlot={(slotInfo) => console.log('Selected slot:', slotInfo)} // Handle slot selection
                  />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ========================== Leads Manager Block ========================== */}
        <div
          style={{ order: blockOrder.Leads }} // Dynamic order
           // Adjusted column spans for default and expanded states
           className={`col-span-12 transition-all duration-300 ease-in-out ${
             isFullView ? "lg:col-span-8" : "lg:col-span-4" // Default: 4/12, Expanded: 8/12
           }`}
        >
          <Card className="h-full flex flex-col"> {/* Ensure card takes full height */}
            <CardHeader>
              {/* Conditional Header for Leads */}
              {isFullView ? (
                // --- Header for Full View ---
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <CardTitle>ניהול לידים (תצוגה מלאה)</CardTitle>
                    <Button onClick={() => setIsFullView(false)} size="sm">תצוגה מקוצרת</Button>
                  </div>
                  {/* Filters/Sort for Full View */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 border-t pt-2">
                    <div>
                      <Label className="ml-1 text-sm font-medium">סדר לפי:</Label>
                      <Select value={leadSortBy} onValueChange={setLeadSortBy}>
                          <SelectTrigger className="h-8 text-sm w-[120px]"><SelectValue placeholder="בחר..." /></SelectTrigger>
                          <SelectContent><SelectItem value="priority">עדיפות</SelectItem><SelectItem value="date">תאריך יצירה</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="ml-1 text-sm font-medium">סנן זמן:</Label>
                      <Select value={leadTimeFilter} onValueChange={setLeadTimeFilter}>
                          <SelectTrigger className="h-8 text-sm w-[130px]"><SelectValue placeholder="בחר..." /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="all">הכל</SelectItem><SelectItem value="week">שבוע אחרון</SelectItem>
                              <SelectItem value="month">חודש אחרון</SelectItem><SelectItem value="custom">טווח תאריכים</SelectItem>
                          </SelectContent>
                      </Select>
                    </div>
                    {leadTimeFilter === "custom" && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Label className="text-sm">מ:</Label>
                        <Input type="date" value={leadFilterFrom} onChange={(e) => setLeadFilterFrom(e.target.value)} className="h-8 text-sm w-[140px]" />
                        <Label className="text-sm">עד:</Label>
                        <Input type="date" value={leadFilterTo} onChange={(e) => setLeadFilterTo(e.target.value)} className="h-8 text-sm w-[140px]" />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // --- Header for Compact View ---
                <div className="flex justify-between items-center">
                  <CardTitle>ניהול לידים</CardTitle>
                  <Button onClick={() => setIsFullView(true)} size="sm">תצוגה מלאה</Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="flex-grow overflow-hidden"> {/* Allow content to grow */}
              {/* Conditional Content for Leads */}
              {isFullView ? (
                // --- Full View: Table ---
                // Adjusted height calculation slightly
                <div className="overflow-auto h-[calc(100vh-300px)] min-h-[400px]"> {/* Adjusted height for header */}
                    <table className="w-full table-fixed text-sm border-collapse">
                    <thead className="sticky top-0 bg-gray-100 z-10">
                        <tr>
                        <th className="px-2 py-2 text-right font-semibold w-16">עדיפות</th>
                        <th className="px-2 py-2 text-right font-semibold w-32">תאריך</th>
                        <th className="px-2 py-2 text-right font-semibold w-40">שם מלא</th>
                        <th className="px-2 py-2 text-right font-semibold w-32">טלפון</th>
                        <th className="px-2 py-2 text-right font-semibold">הודעה</th>
                        <th className="px-2 py-2 text-right font-semibold w-36">סטטוס</th>
                        <th className="px-2 py-2 text-right font-semibold w-28">פעולות</th>
                        </tr>
                    </thead>
                    <tbody>
                        {leadsSorted.length === 0 && (
                            <tr><td colSpan={7} className="text-center text-gray-500 py-6">אין לידים להצגה לפי הסינון הנוכחי</td></tr>
                        )}
                        {leadsSorted.map((lead) => {
                        const colorTab = leadColorTab(lead.status);
                        const isEditingThis = editingLeadId === lead.id;
                        return (
                            <React.Fragment key={`lead-rows-${lead.id}`}>
                            {/* Main Lead Row */}
                            <tr className="border-b hover:bg-gray-50 group">
                                <td className="px-2 py-2 align-top"><div className={`w-3 h-6 ${colorTab} rounded mx-auto`} /></td>
                                <td className="px-2 py-2 align-top whitespace-nowrap">{formatDateTime(lead.createdAt)}</td>
                                <td className="px-2 py-2 align-top font-medium">{lead.fullName}</td>
                                <td className="px-2 py-2 align-top whitespace-nowrap">{lead.phoneNumber}</td>
                                <td className="px-2 py-2 align-top truncate" title={lead.message}>{lead.message}</td>
                                <td className="px-2 py-2 align-top">{lead.status}</td>
                                <td className="px-2 py-2 align-top">
                                <div className="flex items-center justify-start gap-1">
                                    {/* Edit Button - always visible */}
                                    <Button size="icon" variant="ghost" className="w-7 h-7 text-gray-500 hover:text-blue-600" onClick={() => handleEditLead(lead)} title="פתח/ערוך ליד">✎</Button>
                                    {/* WhatsApp and Call Buttons */}
                                    <a href={`https://wa.me/${lead.phoneNumber}`} target="_blank" rel="noopener noreferrer" title="שלח וואטסאפ"><Button size="icon" variant="ghost" className="w-7 h-7 text-green-600 hover:text-green-700">💬</Button></a>
                                    <a href={`tel:${lead.phoneNumber}`} title="התקשר"><Button size="icon" variant="ghost" className="w-7 h-7 text-blue-600 hover:text-blue-700">📞</Button></a>
                                </div>
                                </td>
                            </tr>
                            {/* Expanded Row for Editing/Details */}
                            {lead.expanded && (
                                <tr key={`expanded-${lead.id}`} className="border-b bg-blue-50">
                                <td colSpan={7} className="p-4">
                                    {/* --- Lead Editing Form / Details --- */}
                                    <form onSubmit={(e) => handleSaveLead(e, lead.id)} className="space-y-4">
                                        {/* Form Fields */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            <Label className="block"><span className="text-gray-700 text-sm font-medium">שם מלא:</span><Input type="text" className="mt-1 h-8 text-sm" value={editLeadFullName} onChange={(ev) => setEditLeadFullName(ev.target.value)} required /></Label>
                                            <Label className="block"><span className="text-gray-700 text-sm font-medium">טלפון:</span><Input type="text" className="mt-1 h-8 text-sm" value={editLeadPhone} onChange={(ev) => setEditLeadPhone(ev.target.value)} required /></Label>
                                            <Label className="block"><span className="text-gray-700 text-sm font-medium">הודעה ראשונית:</span><Input type="text" className="mt-1 h-8 text-sm" value={editLeadMessage} onChange={(ev) => setEditLeadMessage(ev.target.value)} /></Label>
                                            <Label className="block"><span className="text-gray-700 text-sm font-medium">סטטוס:</span>
                                                <Select value={editLeadStatus} onValueChange={setEditLeadStatus}>
                                                    <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="בחר..." /></SelectTrigger>
                                                    <SelectContent>{Object.keys(leadStatusConfig).filter(k => k !== 'Default').map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </Label>
                                            <Label className="block"><span className="text-gray-700 text-sm font-medium">מקור:</span><Input type="text" className="mt-1 h-8 text-sm" value={editLeadSource} onChange={(ev) => setEditLeadSource(ev.target.value)} /></Label>
                                        </div>
                                        {/* Conversation History */}
                                        <div className="border-t pt-3">
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="font-semibold text-sm">היסטוריית שיחה:</div>
                                                <Button type="button" variant="link" size="sm" onClick={() => setShowConvUpdate(showConvUpdate === lead.id ? null : lead.id)} className="text-blue-600 hover:underline p-0 h-auto">{showConvUpdate === lead.id ? 'הסתר הוספה' : '+ הוסף עדכון'}</Button>
                                            </div>
                                            {showConvUpdate === lead.id && (
                                                <div className="flex gap-2 mb-3">
                                                <Textarea className="text-sm" rows={2} value={newConversationText} onChange={(ev) => setNewConversationText(ev.target.value)} placeholder="כתוב עדכון שיחה..." />
                                                <Button size="sm" type="button" onClick={() => handleAddConversation(lead.id)} className="shrink-0">הוסף</Button>
                                                </div>
                                            )}
                                            <ul className="space-y-1.5 max-h-40 overflow-y-auto border rounded p-2 bg-white">
                                                {(lead.conversationSummary || []).length === 0 && <li className="text-xs text-gray-500 text-center py-2">אין עדכוני שיחה.</li>}
                                                {(lead.conversationSummary || []).map((c, idx) => (
                                                <li key={idx} className="text-xs bg-gray-50 p-1.5 border rounded">
                                                    <div className="font-semibold text-gray-700">{formatDateTime(c.timestamp)}</div>
                                                    <div className="text-gray-800">{c.text}</div>
                                                </li>
                                                ))}
                                            </ul>
                                        </div>
                                        {/* NLP Task Adder */}
                                        <div className="border-t pt-3">
                                            <Label className="font-semibold text-sm block mb-1">הוסף משימת המשך (NLP):</Label>
                                            <div className="flex gap-2">
                                                <Input type="text" className="h-8 text-sm" placeholder="לדוגמא: לקבוע פגישה מחר ב-10:00..." value={editLeadNLP} onChange={(ev) => setEditLeadNLP(ev.target.value)} />
                                                <Button type="button" size="sm" onClick={() => handleLeadNLPSubmit(lead.id)} className="shrink-0">➕ משימה</Button>
                                            </div>
                                        </div>
                                        {/* Action Buttons */}
                                        <div className="flex gap-2 justify-end border-t pt-3 mt-4">
                                            <Button type="submit" size="sm">שמור שינויים</Button>
                                            <Button type="button" variant="outline" size="sm" onClick={() => handleCollapseLead(lead.id)}>סגור</Button>
                                        </div>
                                    </form>
                                </td>
                                </tr>
                            )}
                            </React.Fragment>
                        );
                        })}
                    </tbody>
                    </table>
                </div>
              ) : (
                // --- Compact View: List ---
                 // Adjusted height calculation slightly
                <ul className="space-y-2 h-[calc(100vh-220px)] min-h-[400px] overflow-y-auto pr-1"> {/* Adjusted height for header */}
                  {leadsSorted.length === 0 && (
                    <li className="text-center text-gray-500 py-6">אין לידים להצגה</li>
                  )}
                  {leadsSorted.map((lead) => {
                    const colorTab = leadColorTab(lead.status);
                    return (
                      <li key={`compact-${lead.id}`} className="p-2 border rounded shadow-sm flex items-center gap-2 bg-white hover:bg-gray-50">
                        <div className={`w-2 h-10 ${colorTab} rounded shrink-0`} />
                        <div className="flex-grow overflow-hidden">
                          <div className="font-bold text-sm truncate">{lead.fullName}</div>
                          <p className="text-xs text-gray-600 truncate">{lead.message}</p>
                          <p className="text-xs text-gray-500 truncate">{lead.status} - {formatDateTime(lead.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                            <Button size="icon" variant="ghost" className="w-7 h-7 text-gray-500 hover:text-blue-600" onClick={() => handleEditLead(lead)} title="פתח לעריכה">✎</Button>
                            <a href={`https://wa.me/${lead.phoneNumber}`} target="_blank" rel="noopener noreferrer" title="שלח וואטסאפ"><Button size="icon" variant="ghost" className="w-7 h-7 text-green-600 hover:text-green-700">💬</Button></a>
                            <a href={`tel:${lead.phoneNumber}`} title="התקשר"><Button size="icon" variant="ghost" className="w-7 h-7 text-blue-600 hover:text-blue-700">📞</Button></a>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

      </div> {/* End Main Grid Layout */}

      {/* ========================== Modals ========================== */}

      {/* --- NLP Task Modal --- */}
      {showNLPModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 p-4" onClick={() => { setShowNLPModal(false); setPrefillCategory(null); }}> {/* Also reset prefill on background click */}
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}> {/* Prevent closing on modal click */}
             {/* Updated Modal title changes based on prefillCategory */}
             <h2 className="text-lg font-semibold mb-4 text-right">
                 הוסף משימה {prefillCategory ? `לקטגוריה: ${prefillCategory}` : 'בשפה טבעית'}
             </h2>
            <form onSubmit={handleNLPSubmit}>
              {/* Optionally show prefilled category */}
              {/* {prefillCategory && <p className="text-sm text-gray-600 mb-2 text-right">קטגוריה: {prefillCategory}</p>} */}
              <Input
                type="text"
                value={nlpInput}
                onChange={(e) => setNlpInput(e.target.value)}
                placeholder="לדוגמא: התקשר לדוד מחר ב-13:00 בנושא דוחות"
                className="text-right"
                dir="rtl"
                autoFocus
                required
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button type="submit">הוסף משימה</Button>
                <Button type="button" variant="outline" onClick={() => { setShowNLPModal(false); setPrefillCategory(null); }}>ביטול</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Return Task Modal --- */}
      {showReturnModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 p-4" onClick={() => setShowReturnModal(false)}>
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4 text-right">החזר משימה עם תגובה</h2>
            <form onSubmit={handleReturnSubmit} className="space-y-3 text-right">
              <div>
                <Label htmlFor="return-assignee" className="block text-sm font-medium mb-1">משתמש יעד:</Label>
                <Input
                  id="return-assignee"
                  type="text"
                  value={returnNewAssignee}
                  onChange={(e) => setReturnNewAssignee(e.target.value)}
                  placeholder="הכנס שם משתמש"
                  required
                />
              </div>
              <div>
                <Label htmlFor="return-comment" className="block text-sm font-medium mb-1">הודעת החזרה:</Label>
                <Textarea
                  id="return-comment"
                  value={returnComment}
                  onChange={(e) => setReturnComment(e.target.value)}
                  placeholder="כתוב תגובה..."
                  rows={3}
                  required
                />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button type="submit">שלח</Button>
                <Button type="button" variant="outline" onClick={() => setShowReturnModal(false)}>ביטול</Button>
              </div>
            </form>
          </div>
        </div>
      )}

       {/* --- Task History Modal --- */}
       {showHistoryModal && (
         <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 p-4" onClick={() => setShowHistoryModal(false)}>
           <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
             <h2 className="text-lg font-semibold mb-4 shrink-0 text-right">היסטוריית משימות שבוצעו</h2>
             <div className="overflow-y-auto flex-grow mb-4 border rounded p-2 bg-gray-50">
               <ul className="space-y-2">
                 {tasks
                   .filter(task => task.done && task.completedAt) // Filter for completed tasks
                   .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()) // Sort by completion date desc
                   .map(task => (
                     <li key={`hist-${task.id}`} className="p-2 border rounded bg-white text-sm text-right">
                       <p className="font-medium">{task.title}</p>
                       <p className="text-xs text-gray-600">
                         בוצע על ידי: <span className="font-semibold">{task.completedBy || 'לא ידוע'}</span> בתאריך: <span className="font-semibold">{formatDateTime(task.completedAt)}</span>
                       </p>
                       {task.subtitle && <p className="text-xs text-gray-500 pt-1 mt-1 border-t">{task.subtitle}</p>}
                     </li>
                   ))
                 }
                 {tasks.filter(task => task.done && task.completedAt).length === 0 && (
                    <li className="text-center text-gray-500 py-6">אין משימות בהיסטוריה.</li>
                 )}
               </ul>
             </div>
             <div className="mt-auto pt-4 border-t flex justify-end shrink-0">
               <Button variant="outline" onClick={() => setShowHistoryModal(false)}>סגור</Button>
             </div>
           </div>
         </div>
       )}

        {/* --- Drag Overlay --- */}
        {/* Renders a custom preview of the item being dragged */}
        <DragOverlay dropAnimation={null}>
            {activeId && activeTaskForOverlay ? (
                 // Render a simplified version of the task item for the overlay
                 <div className="p-2 border rounded shadow-xl bg-white opacity-90">
                     <div className="flex items-start space-x-3 space-x-reverse">
                       <Checkbox checked={!!activeTaskForOverlay.done} readOnly id={`drag-${activeTaskForOverlay.id}`} className="mt-1 shrink-0"/>
                       <div className="flex-grow overflow-hidden">
                         <label htmlFor={`drag-${activeTaskForOverlay.id}`} className={`font-medium text-sm cursor-grabbing ${activeTaskForOverlay.done ? "line-through text-gray-500" : "text-gray-900"}`}>{activeTaskForOverlay.title}</label>
                         {activeTaskForOverlay.subtitle && (<p className={`text-xs mt-0.5 ${activeTaskForOverlay.done ? "line-through text-gray-400" : "text-gray-600"}`}>{activeTaskForOverlay.subtitle}</p>)}
                         <div className="text-xs text-gray-500 mt-1 space-x-2 space-x-reverse">
                           <span>🗓️ {formatDateTime(activeTaskForOverlay.dueDate)}</span>
                           <span>👤 {activeTaskForOverlay.assignTo}</span>
                           <span>🏷️ {activeTaskForOverlay.category}</span>
                           <span>{activeTaskForOverlay.priority === 'דחוף' ? '🔥' : activeTaskForOverlay.priority === 'נמוך' ? '⬇️' : '➖'} {activeTaskForOverlay.priority}</span>
                         </div>
                       </div>
                     </div>
                   </div>
            ) : null}
        </DragOverlay>

    </DndContext> // End DndContext
  ); // End Main Return
} // End Dashboard Component Function
