"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { arrayMove } from "@dnd-kit/sortable";
import SortableItem from "../components/ui/sortable-item";
import DroppableCalendar from "../components/DroppableCalendar";

export default function Dashboard() {
  // ---------------------------
  // General & Layout
  // ---------------------------
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState("month");
  const [filterType, setFilterType] = useState("all");
  const [isFullView, setIsFullView] = useState(false); // For Leads full/compact
  const [mounted, setMounted] = useState(false);
  const [isTMFullView, setIsTMFullView] = useState(false);

  // NLP for tasks
  const [showNLPModal, setShowNLPModal] = useState(false);
  const [nlpInput, setNlpInput] = useState("");

  // Return Task modal
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnTaskId, setReturnTaskId] = useState(null);
  const [returnComment, setReturnComment] = useState("");
  const [returnNewAssignee, setReturnNewAssignee] = useState("");

  // Layout order
  const defaultBlockOrder = { TM: 1, Calendar: 2, Leads: 3 };
  const [blockOrder, setBlockOrder] = useState(defaultBlockOrder);

  useEffect(() => {
    setMounted(true);
    const savedOrder = localStorage.getItem("dashboardBlockOrder");
    if (savedOrder) {
      setBlockOrder(JSON.parse(savedOrder));
    }
  }, []);

  function toggleBlockOrder(key) {
    setBlockOrder((prev) => {
      const newValue = prev[key] === 3 ? 1 : prev[key] + 1;
      const newOrder = { ...prev, [key]: newValue };
      localStorage.setItem("dashboardBlockOrder", JSON.stringify(newOrder));
      return newOrder;
    });
  }

  // ---------------------------
  // Task Manager
  // ---------------------------
  const categories = ["לקבוע סדרה", "דוחות", "תשלומים", "להתקשר", "אדם"];
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
    {
      id: 4,
      assignTo: "אדם",
      title: "משימה 4",
      subtitle: "משימה עבור אדם",
      priority: "רגיל",
      category: "אדם",
      dueDate: new Date(),
      done: false,
    },
  ]);

  const [taskFilter, setTaskFilter] = useState("הכל");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingAssignTo, setEditingAssignTo] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [editingSubtitle, setEditingSubtitle] = useState("");
  const [editingPriority, setEditingPriority] = useState("רגיל");
  const [editingCategory, setEditingCategory] = useState("לקבוע סדרה");
  const [editingDueDate, setEditingDueDate] = useState("");
  const [editingDueTime, setEditingDueTime] = useState("");

  function parseTaskFromText(text) {
    let category = "לקבוע סדרה";
    if (text.includes("להתקשר")) {
      category = "להתקשר";
    }
    let dueDate = new Date();
    if (text.includes("מחר")) {
      dueDate.setDate(dueDate.getDate() + 1);
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
      category,
      dueDate,
      done: false,
    };
  }

  const handleNLPSubmit = (e) => {
    e.preventDefault();
    const newTask = parseTaskFromText(nlpInput);
    setTasks((prev) => [...prev, newTask]);
    setNlpInput("");
    setShowNLPModal(false);
  };

  function handleDragEnd(event) {
    const { active, over, activatorEvent } = event;
    if (!over) return;
    // Dropping on the calendar
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
        const mins = minutesFromStart % 60;
        const newDueDate = new Date(selectedDate);
        newDueDate.setHours(hours, mins, 0, 0);
        const draggedTaskId = active.id;
        setTasks((prev) =>
          prev.map((task) =>
            task.id === draggedTaskId ? { ...task, dueDate: newDueDate } : task
          )
        );
      }
    } else if (over.id !== active.id) {
      // reorder tasks
      setTasks((items) => {
        const oldIndex = items.findIndex((t) => t.id === active.id);
        const newIndex = items.findIndex((t) => t.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  function toggleTaskDone(id) {
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, done: !task.done } : task))
    );
  }

  function handleEditTask(task) {
    setEditingTaskId(task.id);
    setEditingAssignTo(task.assignTo);
    setEditingTitle(task.title);
    setEditingSubtitle(task.subtitle);
    setEditingPriority(task.priority);
    setEditingCategory(task.category);
    const due = new Date(task.dueDate);
    setEditingDueDate(due.toISOString().split("T")[0]);
    setEditingDueTime(due.toTimeString().split(" ")[0].slice(0, 5));
  }

  function handleSaveTask(e) {
    e.preventDefault();
    const dueDateTime = new Date(`${editingDueDate}T${editingDueTime}`);
    setTasks((prev) =>
      prev.map((task) =>
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
    setEditingTaskId(null);
  }

  function handleCancelEdit() {
    setEditingTaskId(null);
  }

  const filteredTasks = tasks.filter((task) => {
    if (taskFilter === "שלי") return task.assignTo === "עצמי";
    if (taskFilter === "אחרים") return task.assignTo !== "עצמי";
    return true;
  });

  const events = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    start: new Date(t.dueDate),
    end: new Date(t.dueDate),
  }));

  // ---------------------------
  // Leads
  // ---------------------------
  // "חדש", "מעקב", "ממתין ליעוץ עם אדם", "תור נקבע", "באג", "לא מתאים", "אין מענה"
  // Priority sort: red (חדש) => orange (מעקב) => purple (ממתין ליעוץ...) => brown (3 statuses) => green (תור נקבע)
  function leadColorTab(s) {
    switch (s) {
      case "חדש":
        return "bg-red-500";
      case "מעקב":
        return "bg-orange-500";
      case "ממתין ליעוץ עם אדם":
        return "bg-purple-500";
      case "תור נקבע":
        return "bg-green-500";
      case "באג":
      case "לא מתאים":
      case "אין מענה":
        return "bg-yellow-900";
      default:
        return "bg-gray-300";
    }
  }
  function leadPriorityValue(s) {
    switch (s) {
      case "חדש":
        return 1;
      case "מעקב":
        return 2;
      case "ממתין ליעוץ עם אדם":
        return 3;
      case "באג":
      case "לא מתאים":
      case "אין מענה":
        return 4; // brown
      case "תור נקבע":
        return 5;
      default:
        return 6;
    }
  }

  const [leads, setLeads] = useState([
    {
      id: 1,
      createdAt: new Date(),
      fullName: "יוסי כהן",
      phoneNumber: "0501234567",
      message: "פולו-אפ על פגישה",
      status: "חדש",
      source: "פייסבוק",
      conversationSummary: [
        { text: "יצירת קשר ראשונית, תיאום פגישה.", timestamp: new Date() },
      ],
      expanded: false,
    },
    {
      id: 2,
      createdAt: new Date("2025-03-30"),
      fullName: "שרה מזרחי",
      phoneNumber: "0527654321",
      message: "שיחת בירור מצב",
      status: "מעקב",
      source: "מבצע טלמרקטינג",
      conversationSummary: [
        {
          text: "שוחחנו על המצב, תיאום שיחה נוספת.",
          timestamp: new Date(),
        },
      ],
      expanded: false,
    },
    {
      id: 3,
      createdAt: new Date("2025-04-01"),
      fullName: "בני גנץ",
      phoneNumber: "0509876543",
      message: "לא היה מענה",
      status: "אין מענה",
      source: "אתר אינטרנט",
      conversationSummary: [
        {
          text: "ניסיתי להתקשר, אין מענה.",
          timestamp: new Date("2025-04-01T10:30:00"),
        },
      ],
      expanded: false,
    },
  ]);

  // Editing states
  const [editingLeadId, setEditingLeadId] = useState(null);
  const [editLeadFullName, setEditLeadFullName] = useState("");
  const [editLeadPhone, setEditLeadPhone] = useState("");
  const [editLeadMessage, setEditLeadMessage] = useState("");
  const [editLeadStatus, setEditLeadStatus] = useState("חדש");
  const [editLeadSource, setEditLeadSource] = useState("");
  const [editLeadNLP, setEditLeadNLP] = useState("");
  const [newConversationText, setNewConversationText] = useState("");
  const [showConvUpdate, setShowConvUpdate] = useState(null);

  // Sort states
  const [leadSortBy, setLeadSortBy] = useState("priority"); // "priority" | "date"
  const [leadTimeFilter, setLeadTimeFilter] = useState("all"); // "all" | "week" | "month" | "custom"
  const [leadFilterFrom, setLeadFilterFrom] = useState("");
  const [leadFilterTo, setLeadFilterTo] = useState("");

  function isLeadInTimeRange(lead) {
    const created = lead.createdAt;
    if (leadTimeFilter === "week") {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      return created >= oneWeekAgo;
    } else if (leadTimeFilter === "month") {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      return created >= oneMonthAgo;
    } else if (leadTimeFilter === "custom") {
      if (leadFilterFrom) {
        const fromDate = new Date(leadFilterFrom);
        if (created < fromDate) return false;
      }
      if (leadFilterTo) {
        const toDate = new Date(leadFilterTo);
        toDate.setHours(23, 59, 59, 999);
        if (created > toDate) return false;
      }
      return true;
    } else {
      // "all"
      return true;
    }
  }

  function compareLeads(a, b) {
    if (leadSortBy === "priority") {
      return leadPriorityValue(a.status) - leadPriorityValue(b.status);
    } else {
      // by date ascending
      return a.createdAt - b.createdAt;
    }
  }

  // leads flow
  function handleEditLead(lead) {
    setEditingLeadId(lead.id);
    setEditLeadFullName(lead.fullName);
    setEditLeadPhone(lead.phoneNumber);
    setEditLeadMessage(lead.message);
    setEditLeadStatus(lead.status);
    setEditLeadSource(lead.source || "");
    setLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, expanded: true } : l))
    );
  }
  function handleLeadNLPSubmit(leadId) {
    if (!editLeadNLP.trim()) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    const newTask = {
      id: Date.now(),
      assignTo: "עצמי",
      title: `Follow up with ${lead.fullName}`,
      subtitle: editLeadNLP,
      priority: "רגיל",
      category: "להתקשר",
      dueDate: new Date(),
      done: false,
    };
    setTasks((old) => [...old, newTask]);
    setEditLeadNLP("");
  }
  function handleSaveLead(e, leadId) {
    e.preventDefault();
    setLeads((old) =>
      old.map((l) => {
        if (l.id === leadId) {
          const updated = {
            ...l,
            fullName: editLeadFullName,
            phoneNumber: editLeadPhone,
            message: editLeadMessage,
            status: editLeadStatus,
            source: editLeadSource,
            // always collapse after saving
            expanded: false,
          };
          return updated;
        }
        return l;
      })
    );
    setEditingLeadId(null);
  }
  function handleCollapseLead(leadId) {
    setLeads((old) =>
      old.map((l) => (l.id === leadId ? { ...l, expanded: false } : l))
    );
    if (editingLeadId === leadId) setEditingLeadId(null);
  }
  function handleAddConversation(leadId) {
    if (!newConversationText.trim()) return;
    setLeads((old) =>
      old.map((l) => {
        if (l.id === leadId) {
          const updatedSummaries = [
            {
              text: newConversationText,
              timestamp: new Date(),
            },
            ...l.conversationSummary,
          ];
          return { ...l, conversationSummary: updatedSummaries };
        }
        return l;
      })
    );
    setNewConversationText("");
  }

  const leadsFiltered = leads.filter(isLeadInTimeRange);
  const leadsSorted = [...leadsFiltered].sort(compareLeads);

  function handleReturnSubmit(e) {
    e.preventDefault();
    setShowReturnModal(false);
  }

  // ---------------------------
  // Render
  // ---------------------------
  return (
    <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
      <div className="grid grid-cols-12 gap-4 p-4 text-right" dir="rtl">
        {/* Logo */}
        <div className="col-span-12 mb-6 flex justify-center">
          <img src="/logo.png" alt="לוגו" className="h-[7.2rem]" />
        </div>

        {/* Task Manager */}
        <div
          style={{ order: blockOrder.TM }}
          className={`transition-all duration-500 ${
            isTMFullView ? "col-span-12 z-10" : "col-span-12 sm:col-span-3"
          }`}
        >
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>
                  {isTMFullView
                    ? "מנהל משימות (תצוגה מלאה)"
                    : "רשימת משימות"}
                </CardTitle>
                <div className="flex gap-2">
                  {isTMFullView ? (
                    <>
                      <Button onClick={() => setIsTMFullView(false)}>
                        סגור תצוגה מלאה
                      </Button>
                      <Button size="xs" onClick={() => toggleBlockOrder("TM")}>
                        מיקום: {blockOrder.TM}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button onClick={() => setShowNLPModal(true)}>+</Button>
                      <Button onClick={() => setIsTMFullView(true)}>
                        תצוגה מלאה
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isTMFullView ? (
                // Full TM: grouped by category
                <div>
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
                      const tasksForCat = filteredTasks.filter(
                        (t) => t.category === cat
                      );
                      return (
                        <div key={cat} className="border p-2 rounded">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold">{cat}</span>
                            <Button size="sm" onClick={() => setShowNLPModal(true)}>
                              +
                            </Button>
                          </div>
                          <SortableContext
                            items={tasksForCat.map((t) => t.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            <ul className="space-y-2">
                              {tasksForCat.map((t) => (
                                <SortableItem key={t.id} id={t.id}>
                                  <div className="border p-2">
                                    <div className="flex items-center gap-2">
                                      <Checkbox
                                        id={`task-${t.id}`}
                                        checked={t.done}
                                        onCheckedChange={() => toggleTaskDone(t.id)}
                                        onPointerDown={(ev) =>
                                          ev.stopPropagation()
                                        }
                                      />
                                      {editingTaskId === t.id ? (
                                        <form
                                          onSubmit={handleSaveTask}
                                          className="flex flex-col w-full"
                                        >
                                          <input
                                            type="text"
                                            value={editingTitle}
                                            onChange={(e) =>
                                              setEditingTitle(e.target.value)
                                            }
                                            className="border p-1 mb-1"
                                            required
                                          />
                                          <input
                                            type="text"
                                            value={editingSubtitle}
                                            onChange={(e) =>
                                              setEditingSubtitle(e.target.value)
                                            }
                                            className="border p-1 mb-1"
                                          />
                                          <div className="flex gap-2 mb-1">
                                            <input
                                              type="text"
                                              value={editingAssignTo}
                                              onChange={(e) =>
                                                setEditingAssignTo(e.target.value)
                                              }
                                              className="border p-1"
                                              required
                                            />
                                            <select
                                              value={editingPriority}
                                              onChange={(e) =>
                                                setEditingPriority(e.target.value)
                                              }
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
                                              onChange={(e) =>
                                                setEditingDueDate(e.target.value)
                                              }
                                              className="border p-1"
                                              required
                                            />
                                            <input
                                              type="time"
                                              value={editingDueTime}
                                              onChange={(e) =>
                                                setEditingDueTime(e.target.value)
                                              }
                                              className="border p-1"
                                              required
                                            />
                                          </div>
                                          <div className="flex gap-2">
                                            <Button type="submit" size="sm">
                                              שמור
                                            </Button>
                                            <Button
                                              type="button"
                                              size="sm"
                                              onClick={handleCancelEdit}
                                            >
                                              ביטול
                                            </Button>
                                          </div>
                                        </form>
                                      ) : (
                                        <div
                                          className="flex-grow"
                                          style={{
                                            textDecoration: t.done
                                              ? "line-through"
                                              : "none",
                                          }}
                                        >
                                          <div className="font-bold">
                                            {t.title}
                                          </div>
                                          <div className="text-sm text-gray-600">
                                            {t.subtitle}
                                          </div>
                                          <div className="text-xs">
                                            הוקצה: {t.assignTo}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    {editingTaskId !== t.id && (
                                      <div className="mt-1 flex justify-between items-center">
                                        <Button
                                          size="sm"
                                          onClick={() => handleEditTask(t)}
                                        >
                                          ערוך
                                        </Button>
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
                </div>
              ) : (
                // Compact TM
                <div>
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
                    <SortableContext
                      items={filteredTasks.map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <ul>
                        {filteredTasks.map((t) => (
                          <SortableItem key={t.id} id={t.id}>
                            <li className="flex flex-col mb-2 border p-2">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`task-${t.id}`}
                                  checked={t.done}
                                  onCheckedChange={() => toggleTaskDone(t.id)}
                                  onPointerDown={(ev) => ev.stopPropagation()}
                                />
                                {editingTaskId === t.id ? (
                                  <form
                                    onSubmit={handleSaveTask}
                                    className="flex flex-col w-full"
                                  >
                                    <input
                                      type="text"
                                      value={editingTitle}
                                      onChange={(e) =>
                                        setEditingTitle(e.target.value)
                                      }
                                      className="border p-1 mb-1"
                                      required
                                    />
                                    <input
                                      type="text"
                                      value={editingSubtitle}
                                      onChange={(e) =>
                                        setEditingSubtitle(e.target.value)
                                      }
                                      className="border p-1 mb-1"
                                    />
                                    <div className="flex gap-2 mb-1">
                                      <input
                                        type="text"
                                        value={editingAssignTo}
                                        onChange={(e) =>
                                          setEditingAssignTo(e.target.value)
                                        }
                                        className="border p-1"
                                        required
                                      />
                                      <select
                                        value={editingPriority}
                                        onChange={(e) =>
                                          setEditingPriority(e.target.value)
                                        }
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
                                        onChange={(e) =>
                                          setEditingDueDate(e.target.value)
                                        }
                                        className="border p-1"
                                        required
                                      />
                                      <input
                                        type="time"
                                        value={editingDueTime}
                                        onChange={(e) =>
                                          setEditingDueTime(e.target.value)
                                        }
                                        className="border p-1"
                                        required
                                      />
                                    </div>
                                    <div className="flex gap-2">
                                      <Button type="submit" size="sm">
                                        שמור
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={handleCancelEdit}
                                      >
                                        ביטול
                                      </Button>
                                    </div>
                                  </form>
                                ) : (
                                  <div
                                    className="flex-grow"
                                    style={{
                                      textDecoration: t.done ? "line-through" : "none",
                                    }}
                                  >
                                    <div className="font-bold">{t.title}</div>
                                    <div className="text-sm text-gray-600">
                                      {t.subtitle}
                                    </div>
                                    <div className="text-xs">
                                      הוקצה: {t.assignTo}
                                    </div>
                                  </div>
                                )}
                              </div>
                              {editingTaskId !== t.id && (
                                <div className="mt-1">
                                  <Button size="sm" onClick={() => handleEditTask(t)}>
                                    ערוך
                                  </Button>
                                </div>
                              )}
                            </li>
                          </SortableItem>
                        ))}
                      </ul>
                    </SortableContext>
                  ) : (
                    <ul>
                      {filteredTasks.map((t) => (
                        <li key={t.id} className="flex items-center gap-2 mb-2">
                          <Checkbox
                            id={`task-${t.id}`}
                            checked={t.done}
                            onCheckedChange={() => toggleTaskDone(t.id)}
                            onPointerDown={(ev) => ev.stopPropagation()}
                          />
                          <div
                            style={{
                              textDecoration: t.done ? "line-through" : "none",
                            }}
                          >
                            <label htmlFor={`task-${t.id}`} className="font-bold">
                              {t.title}
                            </label>
                            <p className="text-sm text-gray-600">{t.subtitle}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Calendar */}
        <div
          style={{ order: blockOrder.Calendar }}
          className="col-span-12 sm:col-span-6"
        >
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>לוח שנה</CardTitle>
                <Button size="xs" onClick={() => toggleBlockOrder("Calendar")}>
                  מיקום: {blockOrder.Calendar}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <DroppableCalendar
                events={events}
                view={view}
                onView={setView}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                // 24-hour format
                formats={{
                  timeGutterFormat: (date, culture, localizer) =>
                    localizer.format(date, "HH:mm", culture),
                  eventTimeRangeFormat: ({ start, end }, culture, localizer) =>
                    `${localizer.format(start, "HH:mm", culture)} - ${localizer.format(
                      end,
                      "HH:mm",
                      culture
                    )}`,
                }}
              />
              <p className="mt-2 text-center">תצוגה נוכחית: {view}</p>
            </CardContent>
          </Card>
        </div>

        {/* Leads Manager */}
        <div
          style={{ order: blockOrder.Leads }}
          className={`col-span-12 transition-all duration-500 ${
            isFullView ? "col-span-12 z-10" : "col-span-3 sm:col-span-3"
          }`}
        >
          <Card>
            <CardHeader>
              {/* For the compact leads view, we do NOT show sort/time filter */}
              {isFullView ? (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <CardTitle>ניהול לידים</CardTitle>
                    <Button onClick={() => setIsFullView(false)} className="mt-2">
                      מעבר לתצוגה מקוצרת
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <div>
                      <label className="mr-1 text-sm">סדר לפי:</label>
                      <select
                        value={leadSortBy}
                        onChange={(e) => setLeadSortBy(e.target.value)}
                        className="border p-1 text-sm"
                      >
                        <option value="priority">עדיפות</option>
                        <option value="date">תאריך יצירה</option>
                      </select>
                    </div>
                    <div>
                      <label className="mr-1 text-sm">סנן לפי זמן:</label>
                      <select
                        value={leadTimeFilter}
                        onChange={(e) => setLeadTimeFilter(e.target.value)}
                        className="border p-1 text-sm"
                      >
                        <option value="all">הכל</option>
                        <option value="week">שבוע אחרון</option>
                        <option value="month">חודש אחרון</option>
                        <option value="custom">טווח תאריכים...</option>
                      </select>
                    </div>
                    {leadTimeFilter === "custom" && (
                      <div className="flex items-center gap-2">
                        <label className="text-sm">מ:</label>
                        <input
                          type="date"
                          value={leadFilterFrom}
                          onChange={(e) => setLeadFilterFrom(e.target.value)}
                          className="border p-1 text-sm"
                        />
                        <label className="text-sm">עד:</label>
                        <input
                          type="date"
                          value={leadFilterTo}
                          onChange={(e) => setLeadFilterTo(e.target.value)}
                          className="border p-1 text-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <CardTitle>ניהול לידים</CardTitle>
                  <Button onClick={() => setIsFullView(true)} className="mt-2">
                    מעבר לתצוגה מלאה
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {isFullView ? (
                <table className="w-full table-auto">
                  <thead>
                    <tr>
                      <th className="px-2 py-1 text-sm font-bold">עדיפות</th>
                      <th className="px-2 py-1 text-sm font-bold">
                        מספר ליד &amp; תאריך יצירה
                      </th>
                      <th className="px-2 py-1 text-sm font-bold">שם מלא</th>
                      <th className="px-2 py-1 text-sm font-bold">טלפון</th>
                      <th className="px-2 py-1 text-sm font-bold">הודעה</th>
                      <th className="px-2 py-1 text-sm font-bold">סטטוס</th>
                      <th className="px-2 py-1 text-sm font-bold">שיחה</th>
                      <th className="px-2 py-1 text-sm font-bold">פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leadsSorted.map((lead) => {
                      const colorTab = leadColorTab(lead.status);
                      const isEditingThis = editingLeadId === lead.id;
                      return (
                        <React.Fragment key={`lead-rows-${lead.id}`}>
                          <tr className="border-b">
                            <td className="px-2 py-2 text-sm">
                              <div className={`w-3 h-10 ${colorTab}`} />
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
                            <td className="px-2 py-2 text-sm">
                              {lead.conversationSummary[0]?.text.slice(0, 20)}...
                            </td>
                            <td className="px-2 py-2 text-sm">
                              <div className="flex items-center justify-start gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditLead(lead)}
                                >
                                  ✎
                                </Button>
                                <a href={`https://wa.me/${lead.phoneNumber}`}>
                                  <Button size="sm" variant="outline">
                                    💬
                                  </Button>
                                </a>
                                <a href={`tel:${lead.phoneNumber}`}>
                                  <Button size="sm" variant="outline">
                                    📞
                                  </Button>
                                </a>
                              </div>
                            </td>
                          </tr>
                          {lead.expanded && (
                            <tr
                              key={`expanded-${lead.id}`}
                              className="border-b bg-gray-50"
                            >
                              <td colSpan={8} className="p-2">
                                {isEditingThis ? (
                                  <form
                                    onSubmit={(e) => handleSaveLead(e, lead.id)}
                                    className="flex flex-col gap-2"
                                  >
                                    <label>
                                      שם מלא:
                                      <input
                                        type="text"
                                        className="border w-full p-1"
                                        value={editLeadFullName}
                                        onChange={(ev) =>
                                          setEditLeadFullName(ev.target.value)
                                        }
                                        required
                                      />
                                    </label>
                                    <label>
                                      טלפון:
                                      <input
                                        type="text"
                                        className="border w-full p-1"
                                        value={editLeadPhone}
                                        onChange={(ev) =>
                                          setEditLeadPhone(ev.target.value)
                                        }
                                        required
                                      />
                                    </label>
                                    <label>
                                      הודעה:
                                      <input
                                        type="text"
                                        className="border w-full p-1"
                                        value={editLeadMessage}
                                        onChange={(ev) =>
                                          setEditLeadMessage(ev.target.value)
                                        }
                                      />
                                    </label>
                                    <label>
                                      סטטוס:
                                      <select
                                        className="border p-1"
                                        value={editLeadStatus}
                                        onChange={(ev) =>
                                          setEditLeadStatus(ev.target.value)
                                        }
                                      >
                                        <option value="חדש">חדש</option>
                                        <option value="מעקב">מעקב</option>
                                        <option value="ממתין ליעוץ עם אדם">
                                          ממתין ליעוץ עם אדם
                                        </option>
                                        <option value="תור נקבע">תור נקבע</option>
                                        <option value="באג">באג</option>
                                        <option value="לא מתאים">לא מתאים</option>
                                        <option value="אין מענה">אין מענה</option>
                                      </select>
                                    </label>
                                    <label>
                                      מקור:
                                      <input
                                        type="text"
                                        className="border w-full p-1"
                                        value={editLeadSource}
                                        onChange={(ev) =>
                                          setEditLeadSource(ev.target.value)
                                        }
                                      />
                                    </label>
                                    <div className="mt-2">
                                      <div className="font-bold">
                                        היסטוריית שיחה:
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setShowConvUpdate(
                                            showConvUpdate === lead.id
                                              ? null
                                              : lead.id
                                          )
                                        }
                                        className="text-blue-500 underline mb-1"
                                      >
                                        הוסף עדכון שיחה
                                      </button>
                                      {showConvUpdate === lead.id && (
                                        <div>
                                          <textarea
                                            className="border w-full p-1 mb-1"
                                            rows={2}
                                            value={newConversationText}
                                            onChange={(ev) =>
                                              setNewConversationText(ev.target.value)
                                            }
                                          />
                                          <Button
                                            size="sm"
                                            onClick={() =>
                                              handleAddConversation(lead.id)
                                            }
                                          >
                                            הוסף
                                          </Button>
                                        </div>
                                      )}
                                      <ul className="mt-2 space-y-1">
                                        {lead.conversationSummary.map((c, idx) => (
                                          <li
                                            key={idx}
                                            className="text-sm bg-white p-2 border rounded"
                                          >
                                            <div className="font-bold">
                                              {c.timestamp.toLocaleString(
                                                "he-IL",
                                                { hour12: false }
                                              )}
                                            </div>
                                            <div>{c.text}</div>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                    <div className="mt-2">
                                      <label className="font-bold">
                                        הוסף משימה (NLP):
                                      </label>
                                      <div className="flex gap-2 mt-1 justify-end">
                                        <input
                                          type="text"
                                          className="border w-full p-1"
                                          placeholder="לדוגמא: צריך להתקשר מחר..."
                                          value={editLeadNLP}
                                          onChange={(ev) =>
                                            setEditLeadNLP(ev.target.value)
                                          }
                                        />
                                        <Button
                                          onClick={() => handleLeadNLPSubmit(lead.id)}
                                        >
                                          ➕ משימה
                                        </Button>
                                      </div>
                                    </div>
                                    <div className="mt-4 flex gap-2 justify-end">
                                      <Button type="submit" size="sm">
                                        שמור ליד
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleCollapseLead(lead.id)}
                                      >
                                        קרוס
                                      </Button>
                                    </div>
                                  </form>
                                ) : (
                                  <div className="text-right">
                                    <Button
                                      variant="outline"
                                      onClick={() => handleCollapseLead(lead.id)}
                                    >
                                      קרוס
                                    </Button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <ul>
                  {leadsSorted.map((lead) => {
                    const colorTab = leadColorTab(lead.status);
                    return (
                      <li key={lead.id} className="mb-4 flex items-center gap-2">
                        <div className={`w-3 h-10 ${colorTab}`} />
                        <div className="flex-grow">
                          <div className="font-bold">{lead.fullName}</div>
                          <p className="text-sm text-gray-600">{lead.message}</p>
                          <div className="mt-2 flex items-center gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditLead(lead)}
                            >
                              ✎
                            </Button>
                            <a href={`https://wa.me/${lead.phoneNumber}`}>
                              <Button size="sm" variant="outline">
                                💬
                              </Button>
                            </a>
                            <a href={`tel:${lead.phoneNumber}`}>
                              <Button size="sm" variant="outline">
                                📞
                              </Button>
                            </a>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* NLP Modal */}
      {showNLPModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-4 rounded w-11/12 sm:w-1/2">
            <h2 className="mb-2 text-lg font-bold\">הוסף משימה בשפה טבעית</h2>
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

      {/* Return Task Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-4 rounded w-11/12 sm:w-1/2">
            <h2 className="mb-2 text-lg font-bold\">החזר משימה עם תגובה</h2>
            <form onSubmit={handleReturnSubmit}>
              <div className="mb-2">
                <label className="block text-sm\">משתמש יעד:</label>
                <input
                  type="text"
                  value={returnNewAssignee}
                  onChange={(e) => setReturnNewAssignee(e.target.value)}
                  placeholder="הכנס שם משתמש"
                  className="border p-1 w-full"
                  required
                />
              </div>
              <div className="mb-2">
                <label className="block text-sm\">הודעת החזרה:</label>
                <textarea
                  value={returnComment}
                  onChange={(e) => setReturnComment(e.target.value)}
                  placeholder="כתוב תגובה"
                  className="border p-1 w-full"
                  required
                />
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <Button type="submit\">שלח</Button>
                <Button type="button\" onClick={() => setShowReturnModal(false)}>
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
