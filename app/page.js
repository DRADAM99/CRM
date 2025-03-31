"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { arrayMove } from "@dnd-kit/sortable";
import SortableItem from "../components/ui/sortable-item";
import DroppableCalendar from "../components/DroppableCalendar";

export default function Dashboard() {
  // General states
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState("month"); // "month", "week", "day"
  const [filterType, setFilterType] = useState("all"); // For leads filtering if needed
  const [isFullView, setIsFullView] = useState(false); // Toggle for leads view
  const [mounted, setMounted] = useState(false);
  
  // State for Task Manager full view toggle (TM view)
  const [isTMFullView, setIsTMFullView] = useState(false);

  // NLP Modal states for adding tasks
  const [showNLPModal, setShowNLPModal] = useState(false);
  const [nlpInput, setNlpInput] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fixed list of task categories
  const categories = ["לקבוע סדרה", "דוחות", "תשלומים", "להתקשר"];

  // Task state (each task includes a "category" field)
  const [tasks, setTasks] = useState([
    {
      id: 1,
      assignTo: "עצמי",
      title: "משימה 1",
      subtitle: "תיאור משימה 1",
      priority: "רגיל",
      category: "לקבוע סדרה",
      dueDate: new Date(),
      done: false,
    },
    {
      id: 2,
      assignTo: "עצמי",
      title: "משימה 2",
      subtitle: "תיאור משימה 2",
      priority: "רגיל",
      category: "דוחות",
      dueDate: new Date(),
      done: false,
    },
    {
      id: 3,
      assignTo: "משתמש אחר",
      title: "משימה 3",
      subtitle: "תיאור משימה 3",
      priority: "דחוף",
      category: "תשלומים",
      dueDate: new Date(),
      done: false,
    },
  ]);

  // Task filter: "הכל" (all), "שלי" (my tasks), "אחרים" (others)
  const [taskFilter, setTaskFilter] = useState("הכל");

  // States for Add Task Form (detailed form version is replaced by NLP modal)
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [newTaskAssignTo, setNewTaskAssignTo] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskSubtitle, setNewTaskSubtitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("רגיל");
  const [newTaskCategory, setNewTaskCategory] = useState("לקבוע סדרה");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskDueTime, setNewTaskDueTime] = useState("");

  // States for editing a task
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingAssignTo, setEditingAssignTo] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [editingSubtitle, setEditingSubtitle] = useState("");
  const [editingPriority, setEditingPriority] = useState("רגיל");
  const [editingCategory, setEditingCategory] = useState("לקבוע סדרה");
  const [editingDueDate, setEditingDueDate] = useState("");
  const [editingDueTime, setEditingDueTime] = useState("");

  // --- Dummy NLP Parser Function ---
  // This simulates AI parsing of a natural language input.
  function parseTaskFromText(text) {
    let category = "לקבוע סדרה";
    if (text.includes("להתקשר")) {
      category = "להתקשר";
    }
    let dueDate = new Date();
    if (text.includes("מחר")) {
      dueDate.setDate(dueDate.getDate() + 1);
      // Try to extract a time in HH:mm format (e.g., "בשעה 13:00" or "13:00")
      const timeMatch = text.match(/(?:בשעה\s*)?(\d{1,2}:\d{2})/);
      if (timeMatch) {
        const [hours, minutes] = timeMatch[1].split(":").map(Number);
        dueDate.setHours(hours, minutes, 0, 0);
      } else {
        dueDate.setHours(13, 0, 0, 0);
      }
    }
    return {
      id: Date.now(),
      assignTo: "עצמי",
      title: text,
      subtitle: "",
      priority: "רגיל",
      category: category,
      dueDate: dueDate,
      done: false,
    };
  }

  const handleNLPSubmit = (e) => {
    e.preventDefault();
    const newTask = parseTaskFromText(nlpInput);
    setTasks([...tasks, newTask]);
    setNlpInput("");
    setShowNLPModal(false);
  };

  // DnDContext handler for tasks and calendar drop
  const handleDragEnd = (event) => {
    const { active, over, activatorEvent } = event;
    console.log("Drag End event:", { active, over, activatorEvent });
    if (!over) return;

    if (over.id === "calendar-dropzone") {
      const calendarEl = document.getElementById("calendar-dropzone");
      if (calendarEl && activatorEvent && activatorEvent.clientY) {
        const dropY = activatorEvent.clientY;
        const rect = calendarEl.getBoundingClientRect();
        const relativeY = dropY - rect.top;
        const fraction = relativeY / rect.height;
        const totalMinutes = 24 * 60;
        const minutesFromStart = Math.floor(fraction * totalMinutes);
        const hours = Math.floor(minutesFromStart / 60);
        const minutes = minutesFromStart % 60;
        const newDueDate = new Date(selectedDate);
        newDueDate.setHours(hours, minutes, 0, 0);
        const draggedTaskId = active.id;
        console.log(`Dropped on calendar. New due time: ${newDueDate}`);
        setTasks((prev) =>
          prev.map((task) =>
            task.id === draggedTaskId ? { ...task, dueDate: newDueDate } : task
          )
        );
      }
    } else if (over.id !== active.id) {
      // Sorting event in compact TM view.
      setTasks((items) => {
        const oldIndex = items.findIndex((task) => task.id === active.id);
        const newIndex = items.findIndex((task) => task.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const toggleTaskDone = (id) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task
      )
    );
  };

  // Filter tasks based on taskFilter state
  const filteredTasks = tasks.filter((task) => {
    if (taskFilter === "שלי") return task.assignTo === "עצמי";
    if (taskFilter === "אחרים") return task.assignTo !== "עצמי";
    return true;
  });

  // Map tasks to events for the calendar
  const events = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    start: new Date(task.dueDate),
    end: new Date(task.dueDate),
  }));

  // Sample Leads data (restored)
  const leads = [
    {
      id: 1,
      createdAt: new Date(),
      fullName: "יוסי כהן",
      phoneNumber: "0501234567",
      message: "פולו-אפ על פגישה",
      status: "חדש",
      conversationSummary: "יצירת קשר ראשונית, תיאום פגישה.",
      priority: 1,
    },
    {
      id: 2,
      createdAt: new Date("2025-03-30"),
      fullName: "שרה מזרחי",
      phoneNumber: "0527654321",
      message: "שיחת בירור מצב",
      status: "פולו-אפ",
      conversationSummary: "שוחחנו על המצב, תיאום שיחה נוספת.",
      priority: 1,
    },
    {
      id: 3,
      createdAt: new Date("2025-04-10"),
      fullName: "איתן רוזן",
      phoneNumber: "0539876543",
      message: "הסבר על המוצר",
      status: "חדש",
      conversationSummary: "הסבר על המוצר, ממתין לתשובה.",
      priority: 1,
    },
    {
      id: 4,
      createdAt: new Date("2025-03-28"),
      fullName: "מיכל לוי",
      phoneNumber: "0543219876",
      message: "פולו-אפ לאחר שליחה",
      status: "פולו-אפ",
      conversationSummary: "המשכנו משם אחרי שליחת הצעה.",
      priority: 2,
    },
    {
      id: 5,
      createdAt: new Date("2025-04-15"),
      fullName: "דניאל כהן",
      phoneNumber: "0507654321",
      message: "בירור צרכים",
      status: "חדש",
      conversationSummary: "צורך בהבהרות לגבי הדרישות.",
      priority: 2,
    },
    {
      id: 6,
      createdAt: new Date("2025-05-10"),
      fullName: "ניצן ברק",
      phoneNumber: "0523456789",
      message: "מעקב אחרי בקשה",
      status: "פולו-אפ",
      conversationSummary: "בקשה לשיחה נוספת.",
      priority: 2,
    },
  ];

  const filteredLeads = leads;
  const sortedLeads = [...filteredLeads].sort((a, b) => a.priority - b.priority);

  // Function to open NLP modal with a preselected category
  const openAddTaskFormForCategory = (cat) => {
    setNewTaskCategory(cat);
    setShowNLPModal(true);
  };

  return (
    <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
      <div className="grid grid-cols-12 gap-4 p-4 text-right" dir="rtl">
        {/* Logo */}
        <div className="col-span-12 mb-6 flex justify-center">
          <img src="/logo.png" alt="לוגו" className="h-[7.2rem]" />
        </div>

        {/* Task Manager Section */}
        {isTMFullView ? (
          // Full Task Manager view: tasks grouped in columns by category.
          <div className="col-span-12 mb-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>מנהל משימות (תצוגה מלאה)</CardTitle>
                  <Button onClick={() => setIsTMFullView(false)}>סגור תצוגה מלאה</Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Global Task Filter */}
                <div className="mb-4">
                  <label className="text-sm">סנן משימות: </label>
                  <select
                    value={taskFilter}
                    onChange={(e) => setTaskFilter(e.target.value)}
                    className="border p-1"
                  >
                    <option value="הכל">הכל</option>
                    <option value="שלי">שלי</option>
                    <option value="אחרים">אחרים</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {categories.map((cat) => {
                    const tasksForCat = filteredTasks.filter(task => task.category === cat);
                    return (
                      <div key={cat} className="border p-2 rounded">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold">{cat}</span>
                          <Button size="sm" onClick={() => openAddTaskFormForCategory(cat)}>+</Button>
                        </div>
                        <SortableContext items={tasksForCat.map(task => task.id)} strategy={verticalListSortingStrategy}>
                          <ul className="space-y-2">
                            {tasksForCat.map((task) => (
                              <SortableItem key={task.id} id={task.id}>
                                <div className="border p-2">
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      id={`task-${task.id}`}
                                      checked={task.done}
                                      onCheckedChange={() => toggleTaskDone(task.id)}
                                      onPointerDown={(e) => e.stopPropagation()}
                                    />
                                    {editingTaskId === task.id ? (
                                      <form onSubmit={handleSaveTask} className="flex flex-col w-full">
                                        <input
                                          type="text"
                                          value={editingTitle}
                                          onChange={(e) => setEditingTitle(e.target.value)}
                                          className="border p-1 mb-1"
                                          required
                                        />
                                        <input
                                          type="text"
                                          value={editingSubtitle}
                                          onChange={(e) => setEditingSubtitle(e.target.value)}
                                          className="border p-1 mb-1"
                                        />
                                        <div className="flex gap-2 mb-1">
                                          <input
                                            type="text"
                                            value={editingAssignTo}
                                            onChange={(e) => setEditingAssignTo(e.target.value)}
                                            className="border p-1"
                                            required
                                          />
                                          <select
                                            value={editingPriority}
                                            onChange={(e) => setEditingPriority(e.target.value)}
                                            className="border p-1"
                                          >
                                            <option value="רגיל">רגיל</option>
                                            <option value="דחוף">דחוף</option>
                                          </select>
                                        </div>
                                        <div className="flex gap-2 mb-1">
                                          <input
                                            type="date"
                                            value={editingDueDate}
                                            onChange={(e) => setEditingDueDate(e.target.value)}
                                            className="border p-1"
                                            required
                                          />
                                          <input
                                            type="time"
                                            value={editingDueTime}
                                            onChange={(e) => setEditingDueTime(e.target.value)}
                                            className="border p-1"
                                            required
                                          />
                                        </div>
                                        <div className="flex gap-2">
                                          <Button type="submit" size="sm">שמור</Button>
                                          <Button type="button" size="sm" onClick={handleCancelEdit}>ביטול</Button>
                                        </div>
                                      </form>
                                    ) : (
                                      <div className="flex-grow" style={{ textDecoration: task.done ? "line-through" : "none" }}>
                                        <div className="font-bold">{task.title}</div>
                                        <div className="text-sm text-gray-600">{task.subtitle}</div>
                                        <div className="text-xs">הוקצה: {task.assignTo}</div>
                                      </div>
                                    )}
                                  </div>
                                  {editingTaskId !== task.id && (
                                    <div className="mt-1">
                                      <Button size="sm" onClick={() => handleEditTask(task)}>ערוך</Button>
                                    </div>
                                  )}
                                </div>
                              </SortableItem>
                            ))}
                          </ul>
                        </SortableContext>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          // Compact Task Manager (sidebar)
          <div className="col-span-12 sm:col-span-3">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>רשימת משימות</CardTitle>
                  <div className="flex gap-2">
                    <Button onClick={() => setShowNLPModal(true)}>+</Button>
                    <Button onClick={() => setIsTMFullView(true)}>תצוגה מלאה</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Task Filter */}
                <div className="mb-2">
                  <label className="text-sm">סנן משימות: </label>
                  <select
                    value={taskFilter}
                    onChange={(e) => setTaskFilter(e.target.value)}
                    className="border p-1"
                  >
                    <option value="הכל">הכל</option>
                    <option value="שלי">שלי</option>
                    <option value="אחרים">אחרים</option>
                  </select>
                </div>
                {mounted ? (
                  <SortableContext items={filteredTasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
                    <ul>
                      {filteredTasks.map((task) => (
                        <SortableItem key={task.id} id={task.id}>
                          <li className="flex flex-col mb-2 border p-2">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`task-${task.id}`}
                                checked={task.done}
                                onCheckedChange={() => toggleTaskDone(task.id)}
                                onPointerDown={(e) => e.stopPropagation()}
                              />
                              {editingTaskId === task.id ? (
                                <form onSubmit={handleSaveTask} className="flex flex-col w-full">
                                  <input
                                    type="text"
                                    value={editingTitle}
                                    onChange={(e) => setEditingTitle(e.target.value)}
                                    className="border p-1 mb-1"
                                    required
                                  />
                                  <input
                                    type="text"
                                    value={editingSubtitle}
                                    onChange={(e) => setEditingSubtitle(e.target.value)}
                                    className="border p-1 mb-1"
                                  />
                                  <div className="flex gap-2 mb-1">
                                    <input
                                      type="text"
                                      value={editingAssignTo}
                                      onChange={(e) => setEditingAssignTo(e.target.value)}
                                      className="border p-1"
                                      required
                                    />
                                    <select
                                      value={editingPriority}
                                      onChange={(e) => setEditingPriority(e.target.value)}
                                      className="border p-1"
                                    >
                                      <option value="רגיל">רגיל</option>
                                      <option value="דחוף">דחוף</option>
                                    </select>
                                  </div>
                                  <div className="flex gap-2 mb-1">
                                    <input
                                      type="date"
                                      value={editingDueDate}
                                      onChange={(e) => setEditingDueDate(e.target.value)}
                                      className="border p-1"
                                      required
                                    />
                                    <input
                                      type="time"
                                      value={editingDueTime}
                                      onChange={(e) => setEditingDueTime(e.target.value)}
                                      className="border p-1"
                                      required
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <Button type="submit" size="sm">שמור</Button>
                                    <Button type="button" size="sm" onClick={handleCancelEdit}>ביטול</Button>
                                  </div>
                                </form>
                              ) : (
                                <div className="flex-grow" style={{ textDecoration: task.done ? "line-through" : "none" }}>
                                  <div className="font-bold">{task.title}</div>
                                  <div className="text-sm text-gray-600">{task.subtitle}</div>
                                  <div className="text-xs">הוקצה: {task.assignTo}</div>
                                </div>
                              )}
                            </div>
                            {editingTaskId !== task.id && (
                              <div className="mt-1">
                                <Button size="sm" onClick={() => handleEditTask(task)}>ערוך</Button>
                              </div>
                            )}
                          </li>
                        </SortableItem>
                      ))}
                    </ul>
                  </SortableContext>
                ) : (
                  <ul>
                    {filteredTasks.map((task) => (
                      <li key={task.id} className="flex items-center gap-2 mb-2">
                        <Checkbox
                          id={`task-${task.id}`}
                          checked={task.done}
                          onCheckedChange={() => toggleTaskDone(task.id)}
                          onPointerDown={(e) => e.stopPropagation()}
                        />
                        <div style={{ textDecoration: task.done ? "line-through" : "none" }}>
                          <label htmlFor={`task-${task.id}`} className="font-bold">
                            {task.title}
                          </label>
                          <p className="text-sm text-gray-600">{task.subtitle}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Calendar Section */}
        <div className="col-span-12 sm:col-span-6">
          <Card>
            <CardHeader>
              <CardTitle>לוח שנה</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between mb-2">
                <Button onClick={() => setView("month")}>חודש</Button>
                <Button onClick={() => setView("week")}>שבוע</Button>
                <Button onClick={() => setView("day")}>יום</Button>
              </div>
              <DroppableCalendar
                events={events}
                view={view}
                onView={(newView) => setView(newView)}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
              />
              <p className="mt-2 text-center">תצוגה נוכחית: {view}</p>
            </CardContent>
          </Card>
        </div>

        {/* Leads Management Section */}
        <div className={`col-span-12 transition-all duration-500 ${isFullView ? "col-span-12 z-10" : "col-span-3 sm:col-span-3"}`}>
          <Card>
            <CardHeader>
              <CardTitle>ניהול לידים</CardTitle>
              <Button onClick={() => setIsFullView(!isFullView)} className="mt-2">
                {isFullView ? "מעבר לתצוגה מקוצרת" : "מעבר לתצוגה מלאה"}
              </Button>
            </CardHeader>
            <CardContent>
              {isFullView ? (
                <table className="w-full table-auto">
                  <thead>
                    <tr>
                      <th className="px-2 py-1 text-sm font-bold">עדיפות</th>
                      <th className="px-2 py-1 text-sm font-bold">מספר ליד &amp; תאריך יצירה</th>
                      <th className="px-2 py-1 text-sm font-bold">שם מלא</th>
                      <th className="px-2 py-1 text-sm font-bold">טלפון</th>
                      <th className="px-2 py-1 text-sm font-bold">הודעה</th>
                      <th className="px-2 py-1 text-sm font-bold">סטטוס</th>
                      <th className="px-2 py-1 text-sm font-bold">סיכום שיחה</th>
                      <th className="px-2 py-1 text-sm font-bold">פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedLeads.map((lead) => (
                      <tr key={lead.id} className="border-b">
                        <td className="px-2 py-2 text-sm">
                          <div className={`w-3 h-10 ${lead.priority === 1 ? "bg-red-500" : "bg-orange-500"}`} />
                        </td>
                        <td className="px-2 py-2 text-sm">
                          {lead.id} <br />
                          {lead.createdAt.toLocaleDateString()} <br />
                          {lead.createdAt.toLocaleTimeString("he-IL", {
                            hour12: false,
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-2 py-2 text-sm">{lead.fullName}</td>
                        <td className="px-2 py-2 text-sm">{lead.phoneNumber}</td>
                        <td className="px-2 py-2 text-sm">{lead.message}</td>
                        <td className="px-2 py-2 text-sm">{lead.status}</td>
                        <td className="px-2 py-2 text-sm">{lead.conversationSummary}</td>
                        <td className="px-2 py-2 text-sm">
                          <a href={`tel:${lead.phoneNumber}`} className="text-blue-500 mr-2">
                            <Button>התקשר</Button>
                          </a>
                          <a href={`https://wa.me/${lead.phoneNumber}`} className="text-green-500">
                            <Button>WhatsApp</Button>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <ul>
                  {filteredLeads.map((lead) => (
                    <li key={lead.id} className="mb-4 flex items-center gap-2">
                      <div className={`w-3 h-10 ${lead.priority === 1 ? "bg-red-500" : "bg-orange-500"}`} />
                      <div className="flex-grow">
                        <div className="font-bold">{lead.fullName}</div>
                        <p className="text-sm text-gray-600">{lead.message}</p>
                        <div className="mt-2">
                          <a href={`tel:${lead.phoneNumber}`} className="text-blue-500 mr-2">
                            <Button>התקשר</Button>
                          </a>
                          <a href={`https://wa.me/${lead.phoneNumber}`} className="text-green-500">
                            <Button>WhatsApp</Button>
                          </a>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* NLP Modal for Adding a Task */}
      {showNLPModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-4 rounded w-11/12 sm:w-1/2">
            <h2 className="mb-2 text-lg font-bold">הוסף משימה בשפה טבעית</h2>
            <form onSubmit={handleNLPSubmit}>
              <input
                type="text"
                value={nlpInput}
                onChange={(e) => setNlpInput(e.target.value)}
                placeholder="לדוגמא: התקשר לדוד מחר בשעה 13:00"
                className="border p-2 w-full"
                autoFocus
                required
              />
              <div className="mt-2 flex justify-end gap-2">
                <Button type="submit">הוסף משימה</Button>
                <Button type="button" onClick={() => setShowNLPModal(false)}>
                  ביטול
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DndContext>
  );
}
