"use client"

import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { formatISO, parseISO } from 'date-fns';
import { db } from '../firebase';
import { collection, onSnapshot, doc, getDoc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';

// Use the same categories and priorities as the main app
const taskCategories = ["לקבוע סדרה", "דוחות", "תשלומים", "להתקשר", "תוכנית טיפול", "אחר"];
const taskPriorities = ["דחוף", "רגיל", "נמוך"];
const pastelColors = [
  "#eaccd8", // ורדרד
  "#bee4e5", // תכלכל
  "#c8c7ef", // סגלגל
  "#cfe8bc", // ירקרק
  "#efe9b4", // צהבהב
  "#edccb4", // כתמתם
  "#bfb599", // זהבהב
];
const CATEGORY_COLORS = Object.fromEntries(taskCategories.map((cat, i) => [cat, pastelColors[i % pastelColors.length]]));

const USER_COLORS = [
  '#b5ead7', // green
  '#bee4e5', // blue
  '#c8c7ef', // purple
  '#efe9b4', // yellow
  '#eaccd8', // pink
];

function formatDateTime(date) {
  if (!date) return "";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return `${d.toLocaleDateString("he-IL")} ${d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  } catch (error) { return ""; }
}

// Add a helper to convert hex to rgba
function hexToRgba(hex, alpha) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

// Helper for localStorage persistence
function getUserColorsFromStorage() {
  try {
    const val = localStorage.getItem('calendar_userColors');
    if (val) return JSON.parse(val);
  } catch {}
  return {};
}
function setUserColorsToStorage(colors) {
  try {
    localStorage.setItem('calendar_userColors', JSON.stringify(colors));
  } catch {}
}

function getBlockOrderFromStorage() {
  try {
    const val = localStorage.getItem('calendar_blockOrder');
    if (val) return JSON.parse(val);
  } catch {}
  return 2; // default order: 2 (middle)
}
function setBlockOrderToStorage(order) {
  try {
    localStorage.setItem('calendar_blockOrder', JSON.stringify(order));
  } catch {}
}

// Custom user filter dropdown with checkboxes and color pickers
function UserMultiSelectDropdown({ users, value, onChange, currentUser, alias, userColors, setUserColors, isTouch }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);
  const toggle = v => {
    if (v === 'all') {
      onChange(['all']);
    } else if (v === 'mine') {
      onChange(['mine']);
    } else {
      let newVal = value.includes('all') || value.includes('mine') ? [] : [...value];
      if (newVal.includes(v)) newVal = newVal.filter(x => x !== v);
      else newVal.push(v);
      onChange(newVal);
    }
  };
  const checked = v => value.includes(v);
  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 120 }}>
      <button
        style={{ border: '1px solid #e0e0e0', borderRadius: 6, padding: '12px 18px', fontSize: 17, background: '#fff', cursor: 'pointer', minWidth: 120, minHeight: 44 }}
        onClick={() => setOpen(o => !o)}
        type="button"
      >
        {value.includes('all') ? 'כל המשימות' : value.includes('mine') ? 'המשימות שלי' : value.length === 0 ? 'בחר משתמשים' : ''}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '110%', right: 0, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, boxShadow: '0 2px 8px #0002', zIndex: 10, minWidth: 240, padding: 8 }}>
          <label style={{ display: 'block', padding: 8, cursor: 'pointer', minHeight: 44, fontSize: 16 }}>
            <input type="checkbox" checked={checked('mine')} onChange={() => toggle('mine')} style={{ width: 22, height: 22, marginLeft: 8 }} /> המשימות שלי
          </label>
          <label style={{ display: 'block', padding: 8, cursor: 'pointer', minHeight: 44, fontSize: 16 }}>
            <input type="checkbox" checked={checked('all')} onChange={() => toggle('all')} style={{ width: 22, height: 22, marginLeft: 8 }} /> כל המשימות
          </label>
          <div style={{ borderTop: '1px solid #eee', margin: '8px 0' }} />
          {users.map(u => (
            <label key={u.id} style={{ display: 'flex', alignItems: 'center', padding: 8, cursor: 'pointer', gap: 10, minHeight: 44, fontSize: 16 }}>
              <input type="checkbox" checked={checked(u.email)} onChange={() => toggle(u.email)} style={{ width: 22, height: 22 }} />
              <span>{u.alias ? u.alias : u.email}</span>
              <div style={{ display: 'flex', gap: 4, marginRight: 8 }}>
                {USER_COLORS.map(color => (
                  <span
                    key={color}
                    onClick={e => { e.stopPropagation(); setUserColors(c => { const next = { ...c, [u.email]: color }; setUserColorsToStorage(next); return next; }); }}
                    title={!isTouch ? (userColors[u.email] === color ? 'הצבע הנבחר' : 'בחר צבע') : undefined}
                    style={{
                      width: 28, height: 28, borderRadius: '50%', background: color, border: userColors[u.email] === color ? '3px solid #222' : '2px solid #ccc', cursor: 'pointer', display: 'inline-block', marginLeft: 4, boxShadow: userColors[u.email] === color ? '0 0 0 2px #a7c7e7' : 'none', transition: 'border 0.2s',
                    }}
                  >
                    {isTouch && userColors[u.email] === color && (
                      <span style={{ display: 'block', width: 12, height: 12, borderRadius: '50%', background: '#222', margin: 'auto', marginTop: 6 }} />
                    )}
                  </span>
                ))}
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FullCalendarDemo({ isCalendarFullView }) {
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [alias, setAlias] = useState("");
  const [editEvent, setEditEvent] = useState(null);
  const [editFields, setEditFields] = useState({});
  const [replyText, setReplyText] = useState("");
  const [userFilter, setUserFilter] = useState('all');
  const [selectedCategories, setSelectedCategories] = useState(taskCategories);
  const [currentView, setCurrentView] = useState('timeGridDay');
  const [searchTerm, setSearchTerm] = useState('');
  const [userFilterMulti, setUserFilterMulti] = useState(['mine']);
  const [lastFullView, setLastFullView] = useState('timeGridWeek');
  const [userColors, setUserColors] = useState(() => getUserColorsFromStorage());
  const [isTouch, setIsTouch] = useState(false);
  const [blockOrder, setBlockOrder] = useState(() => getBlockOrderFromStorage());
  const calendarRef = useRef();

  // Fetch users
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const usersData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
      // Simulate current user as first user for demo; replace with real auth in prod
      if (!currentUser && usersData.length > 0) {
        setCurrentUser(usersData[0]);
        setAlias(usersData[0].alias || usersData[0].email);
      }
    });
    return () => unsub();
  }, []);

  // Fetch tasks and leads
  useEffect(() => {
    const unsubTasks = onSnapshot(collection(db, "tasks"), (snap) => {
      const tasks = snap.docs.map(doc => {
        const data = doc.data();
        let dueDate = null;
        if (data.dueDate) {
          if (typeof data.dueDate.toDate === 'function') dueDate = data.dueDate.toDate();
          else if (typeof data.dueDate === 'string') dueDate = new Date(data.dueDate);
          else if (data.dueDate instanceof Date) dueDate = data.dueDate;
        }
        return {
          ...data,
          id: doc.id,
          type: 'task',
          start: dueDate,
          end: dueDate ? new Date(dueDate.getTime() + 20 * 60 * 1000) : null,
          color: CATEGORY_COLORS[data.category],
        };
      });
      setEvents(prev => {
        const leads = prev.filter(e => e.type === 'lead');
        return [...tasks, ...leads];
      });
    });
    const unsubLeads = onSnapshot(collection(db, "leads"), (snap) => {
      const leads = snap.docs.filter(doc => {
        const d = doc.data();
        return d.status === 'תור נקבע' && d.appointmentDateTime;
      }).map(doc => {
        const d = doc.data();
        let start = null;
        if (d.appointmentDateTime) {
          if (typeof d.appointmentDateTime.toDate === 'function') start = d.appointmentDateTime.toDate();
          else if (typeof d.appointmentDateTime === 'string') start = new Date(d.appointmentDateTime);
          else if (d.appointmentDateTime instanceof Date) start = d.appointmentDateTime;
        }
        return {
          id: `lead-${doc.id}`,
          type: 'lead',
          title: `פגישה: ${d.fullName}`,
          start,
          end: start ? new Date(start.getTime() + 20 * 60 * 1000) : null,
          color: '#b5ead7',
          lead: d,
        };
      });
      setEvents(prev => {
        const tasks = prev.filter(e => e.type === 'task');
        return [...tasks, ...leads];
      });
    });
    return () => { unsubTasks(); unsubLeads(); };
  }, []);

  // Detect touch device (iPad, etc.)
  useEffect(() => {
    setIsTouch(('ontouchstart' in window) || navigator.maxTouchPoints > 0);
  }, []);

  // Persist userColors on change
  useEffect(() => { setUserColorsToStorage(userColors); }, [userColors]);

  // Category filter
  const handleCategoryToggle = (cat) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  // View sync logic
  useEffect(() => {
    const newView = isCalendarFullView ? 'timeGridWeek' : 'timeGridDay';
    setCurrentView(newView);
    if (calendarRef.current) {
      calendarRef.current.getApi().changeView(newView);
    }
  }, [isCalendarFullView]);

  // Track last full view
  useEffect(() => {
    if (isCalendarFullView && ['timeGridDay', 'timeGridWeek', 'dayGridMonth', 'listWeek'].includes(currentView)) {
      setLastFullView(currentView);
    }
  }, [isCalendarFullView, currentView]);

  // Filtered events (with search and multi-user filter)
  const filteredEvents = events.filter(ev => {
    if (ev.type === 'task') {
      if (userFilterMulti.includes('all')) {
        // show all
      } else if (userFilterMulti.includes('mine')) {
        if (ev.assignTo !== currentUser?.email) return false;
      } else if (userFilterMulti.length > 0) {
        if (!userFilterMulti.some(email => ev.assignTo === email)) return false;
      }
      if (!selectedCategories.includes(ev.category)) return false;
      if (searchTerm && !(
        (ev.title && ev.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (ev.subtitle && ev.subtitle.toLowerCase().includes(searchTerm.toLowerCase()))
      )) return false;
    }
    return true;
  });

  // Event click handler
  const handleEventClick = (info) => {
    const ev = events.find(e => e.id === info.event.id);
    if (!ev) return;
    setEditEvent(ev);
    if (ev.type === 'task') {
      setEditFields({
        ...ev,
        date: ev.start ? formatISO(ev.start, { representation: 'date' }) : '',
        time: ev.start ? ev.start.toTimeString().slice(0, 5) : '',
      });
    } else if (ev.type === 'lead') {
      setEditFields({ ...ev });
    }
    setReplyText("");
  };

  // Minimal reply UI logic
  const handleTaskReply = async (taskId, replyText) => {
    if (!replyText.trim() || !currentUser) return;
    try {
      const taskRef = doc(db, 'tasks', taskId);
      const taskDoc = await getDoc(taskRef);
      if (!taskDoc.exists()) return;
      const taskData = taskDoc.data();
      // Permission check (same as page.js)
      const hasPermission =
        taskData.userId === currentUser.uid ||
        taskData.creatorId === currentUser.uid ||
        taskData.assignTo === currentUser.uid ||
        taskData.assignTo === currentUser.email ||
        taskData.assignTo === alias;
      if (!hasPermission) {
        alert('אין לך הרשאה להוסיף תגובה למשימה זו');
        return;
      }
      const now = new Date();
      const newReply = {
        id: `reply-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: replyText,
        timestamp: now,
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userAlias: alias || currentUser.email,
        isRead: false
      };
      const existingReplies = taskData.replies || [];
      await updateDoc(taskRef, {
        replies: [...existingReplies, newReply],
        hasNewReply: true,
        lastReplyAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setReplyText("");
    } catch (error) {
      alert('שגיאה בהוספת תגובה');
    }
  };

  // Mark as done
  const handleTaskDone = async (taskId, checked) => {
    if (!currentUser) return;
    try {
      const taskRef = doc(db, 'tasks', taskId);
      const now = new Date();
      await updateDoc(taskRef, {
        done: checked,
        completedBy: checked ? (currentUser.email || currentUser.uid) : null,
        completedByAlias: checked ? (alias || currentUser.email) : null,
        completedAt: checked ? now : null,
        updatedAt: serverTimestamp()
      });
    } catch (error) {}
  };

  // Toggle message sent
  const handleMessageSent = async (taskId, checked) => {
    if (!currentUser) return;
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await updateDoc(taskRef, {
        messageSent: checked,
        updatedAt: serverTimestamp()
      });
    } catch (error) {}
  };

  // Drag & drop: keep category, update time and preserve duration
  const handleEventDrop = (info) => {
    setEvents(prev => prev.map(ev => {
      if (ev.id === info.event.id) {
        const oldStart = new Date(ev.start);
        const oldEnd = new Date(ev.end || oldStart);
        const duration = oldEnd.getTime() - oldStart.getTime();
        const newStart = info.event.start;
        const newEnd = new Date(newStart.getTime() + duration);
        return { ...ev, start: formatISO(newStart), end: formatISO(newEnd) };
      }
      return ev;
    }));
  };

  // Open modal for edit
  const handleAddNew = () => {
    const newId = (Math.max(...events.map(e => +e.id)) + 1).toString();
    setEvents(prev => [
      ...prev,
      {
        id: newId,
        ...editFields,
        start: editFields.date && editFields.time ? formatISO(new Date(`${editFields.date}T${editFields.time}`)) : formatISO(new Date()),
        done: editFields.done || false,
        messageSent: editFields.messageSent || false,
      },
    ]);
    setEditEvent(null);
  };

  // Pastel event rendering
  function renderEventContent(eventInfo, createElement) {
    const { done, messageSent } = eventInfo.event.extendedProps;
    const isWeekView = eventInfo.view && eventInfo.view.type === 'timeGridWeek';
    const baseColor = CATEGORY_COLORS[eventInfo.event.extendedProps.category];
    const bgColor = done ? hexToRgba(baseColor, 0.8) : baseColor;
    const assignTo = eventInfo.event.extendedProps.assignTo;
    const accentColor = userColors[assignTo] || '#e0e0e0';
    return (
      <div
        style={{
          background: bgColor,
          borderRadius: 12,
          padding: isTouch ? '8px 10px 8px 6px' : '2px 6px',
          opacity: done ? 0.8 : 1,
          border: 'none',
          fontSize: isTouch ? 17 : 14,
          color: done ? '#bbb' : '#222',
          boxShadow: '0 1px 4px #0001',
          marginBottom: isTouch ? 8 : 2,
          pointerEvents: 'auto',
          cursor: 'pointer',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: isTouch ? 14 : 8,
          position: 'relative',
          minHeight: isTouch ? 56 : 0,
        }}
      >
        {/* Accent bar for user color */}
        <div style={{ position: 'absolute', top: isTouch ? 4 : 2, bottom: isTouch ? 4 : 2, right: isTouch ? 4 : 2, width: isTouch ? 10 : 6, borderRadius: 4, background: accentColor, zIndex: 2 }} />
        {/* Icons area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: isTouch ? 8 : 2, alignItems: 'center', marginTop: isTouch ? 6 : 2 }}>
          {/* Checkmark SVG */}
          <span
            draggable={false}
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
              // Toggle done for this event
              if (eventInfo.event.id && typeof handleTaskDone === 'function') {
                handleTaskDone(eventInfo.event.id, !done);
              }
            }}
            title={done ? 'סמן כלא הושלם' : 'סמן כהושלם'}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: isTouch ? 36 : 24, height: isTouch ? 36 : 24, cursor: 'pointer', background: 'none', border: 'none', borderRadius: 0, fontSize: isTouch ? 22 : 16 }}
          >
            {done ? (
              <svg width={isTouch ? 28 : 18} height={isTouch ? 28 : 18} viewBox="0 0 24 24" fill="none" stroke="#4caf50" strokeWidth={isTouch ? 4 : 3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 10 18 4 12" /></svg>
            ) : (
              <svg width={isTouch ? 28 : 18} height={isTouch ? 28 : 18} viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth={isTouch ? 3.5 : 2.5} strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="4" /></svg>
            )}
          </span>
          {/* Envelope SVG */}
          <span
            draggable={false}
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
              // Toggle messageSent for this event
              if (eventInfo.event.id && typeof handleMessageSent === 'function') {
                handleMessageSent(eventInfo.event.id, !messageSent);
              }
            }}
            title={messageSent ? 'הודעה נשלחה' : 'סמן הודעה נשלחה'}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: isTouch ? 36 : 24, height: isTouch ? 36 : 24, cursor: 'pointer', background: 'none', border: 'none', borderRadius: 0, fontSize: isTouch ? 22 : 16 }}
          >
            <svg width={isTouch ? 28 : 18} height={isTouch ? 28 : 18} viewBox="0 0 24 24" 
              fill={messageSent ? '#4caf50' : 'none'} 
              stroke={messageSent ? '#111' : '#555'} 
              strokeWidth={isTouch ? 3.5 : 2.5} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="3" />
              <polyline points="3 7 12 13 21 7" />
            </svg>
          </span>
        </div>
        {/* Content area */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'flex-start' }}>
          <div style={{ fontWeight: 600, marginTop: isTouch ? 8 : 4 }}>{eventInfo.event.title}</div>
          <div style={{ fontSize: isTouch ? 15 : 12, color: '#555' }}>{eventInfo.event.extendedProps.subtitle}</div>
          <div style={{ fontSize: isTouch ? 13 : 11, color: '#888' }}>{eventInfo.event.extendedProps.category} | {eventInfo.event.extendedProps.priority}</div>
        </div>
      </div>
    );
  }

  // Delete all done tasks
  const handleDeleteAllDone = async () => {
    if (!window.confirm('למחוק את כל המשימות שבוצעו?')) return;
    const doneTasks = events.filter(ev => ev.type === 'task' && ev.done);
    for (const task of doneTasks) {
      try {
        await updateDoc(doc(db, 'tasks', task.id), { isArchived: true }); // or use deleteDoc if you want to delete
      } catch (e) { /* ignore */ }
    }
  };

  // Block order logic
  const cycleBlockOrder = () => {
    const next = blockOrder === 3 ? 1 : blockOrder + 1;
    setBlockOrder(next);
    setBlockOrderToStorage(next);
  };

  // --- 1. Persist full/compact state and calendar view in localStorage ---
  useEffect(() => {
    try {
      localStorage.setItem('calendar_isFullView', JSON.stringify(isCalendarFullView));
      localStorage.setItem('calendar_currentView', currentView);
    } catch {}
  }, [isCalendarFullView, currentView]);

  useEffect(() => {
    try {
      const savedFullView = localStorage.getItem('calendar_isFullView');
      const savedView = localStorage.getItem('calendar_currentView');
      if (savedFullView !== null) setIsCalendarFullView(JSON.parse(savedFullView));
      if (savedView) setCurrentView(savedView);
    } catch {}
    // eslint-disable-next-line
  }, []);

  return (
    <div
      style={{
        maxWidth: isCalendarFullView ? 1000 : 420,
        margin: '40px auto',
        background: '#f8fafc',
        borderRadius: 12,
        boxShadow: '0 2px 12px #0001',
        padding: 32,
        transition: 'max-width 0.3s',
        fontSize: isTouch ? 18 : 15,
        order: blockOrder,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ textAlign: 'center', fontWeight: 700, color: '#3b3b3b', fontSize: 28, margin: 0 }}>
          יומן ניהול משימות
        </h2>
      </div>
      {/* Control bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: isTouch ? 18 : 12, alignItems: 'center', marginBottom: 18, overflowX: isTouch ? 'auto' : 'visible', WebkitOverflowScrolling: 'touch' }}>
        {/* View buttons always visible and working */}
        <div style={{ display: 'flex', gap: isTouch ? 10 : 4 }}>
          <button
            style={{ background: currentView === 'timeGridDay' ? '#a7c7e7' : '#eee', color: '#222', border: 'none', borderRadius: 8, padding: isTouch ? '12px 20px' : '6px 14px', fontWeight: 600, fontSize: isTouch ? 18 : 15, cursor: 'pointer', minWidth: 44, minHeight: 44 }}
            onClick={() => {
              setCurrentView('timeGridDay');
              if (calendarRef.current) calendarRef.current.getApi().changeView('timeGridDay');
            }}
          >יום</button>
          <button
            style={{ background: currentView === 'timeGridWeek' ? '#a7c7e7' : '#eee', color: '#222', border: 'none', borderRadius: 8, padding: isTouch ? '12px 20px' : '6px 14px', fontWeight: 600, fontSize: isTouch ? 18 : 15, cursor: 'pointer', minWidth: 44, minHeight: 44 }}
            onClick={() => {
              setCurrentView('timeGridWeek');
              if (calendarRef.current) calendarRef.current.getApi().changeView('timeGridWeek');
            }}
          >שבוע</button>
          <button
            style={{ background: currentView === 'dayGridMonth' ? '#a7c7e7' : '#eee', color: '#222', border: 'none', borderRadius: 8, padding: isTouch ? '12px 20px' : '6px 14px', fontWeight: 600, fontSize: isTouch ? 18 : 15, cursor: 'pointer', minWidth: 44, minHeight: 44 }}
            onClick={() => {
              setCurrentView('dayGridMonth');
              if (calendarRef.current) calendarRef.current.getApi().changeView('dayGridMonth');
            }}
          >חודש</button>
          <button
            style={{ background: currentView === 'listWeek' ? '#a7c7e7' : '#eee', color: '#222', border: 'none', borderRadius: 8, padding: isTouch ? '12px 20px' : '6px 14px', fontWeight: 600, fontSize: isTouch ? 18 : 15, cursor: 'pointer', minWidth: 44, minHeight: 44 }}
            onClick={() => {
              setCurrentView('listWeek');
              if (calendarRef.current) calendarRef.current.getApi().changeView('listWeek');
            }}
          >רשימה</button>
        </div>
        {/* Delete all done tasks */}
        <button
          style={{ background: '#fbb', color: '#222', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
          onClick={handleDeleteAllDone}
        >מחק משימות שבוצעו</button>
        {/* Search input */}
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="חפש משימה..."
          style={{ borderRadius: 8, padding: isTouch ? '12px 16px' : '6px 12px', fontSize: isTouch ? 17 : 15, border: '1px solid #e0e0e0', minWidth: 120, minHeight: 44 }}
        />
        {/* User filter dropdown */}
        <UserMultiSelectDropdown
          users={users}
          value={userFilterMulti}
          onChange={setUserFilterMulti}
          currentUser={currentUser}
          alias={alias}
          userColors={userColors}
          setUserColors={setUserColors}
          isTouch={isTouch}
        />
      </div>
      <div style={{ marginBottom: 24, textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontWeight: 500, marginLeft: 8 }}>סנן לפי קטגוריה:</label>
          {taskCategories.map(cat => (
            <label key={cat} style={{ margin: '0 8px', fontWeight: 400, color: '#444', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedCategories.includes(cat)}
                onChange={() => handleCategoryToggle(cat)}
                style={{ accentColor: CATEGORY_COLORS[cat], marginLeft: 4 }}
              />
              {cat}
            </label>
          ))}
        </div>
        <button
          style={{ background: '#b5ead7', color: '#222', border: 'none', borderRadius: 6, padding: '6px 18px', fontWeight: 600, fontSize: 16, boxShadow: '0 1px 4px #0001', cursor: 'pointer' }}
          onClick={() => {
            setEditEvent({ id: '', isNew: true });
            setEditFields({ title: '', subtitle: '', category: taskCategories[0], priority: taskPriorities[1], assignTo: currentUser?.email || '', date: '', time: '', done: false, messageSent: false });
          }}
        >+ משימה חדשה</button>
      </div>
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
        initialView={isCalendarFullView ? lastFullView : currentView}
        view={currentView}
        headerToolbar={isCalendarFullView
          ? { right: 'prev,next today', center: 'title', left: '' }
          : { right: 'prev,next today', center: 'title', left: '' }
        }
        events={filteredEvents}
        editable={true}
        droppable={true}
        eventDrop={handleEventDrop}
        eventClick={handleEventClick}
        height={isCalendarFullView ? 700 : 520}
        locale="he"
        direction="rtl"
        eventContent={renderEventContent}
        slotMinTime="08:00:00"
        slotMaxTime="20:00:00"
        hiddenDays={[6]}
        datesSet={arg => {
          setCurrentView(arg.view.type);
        }}
        dayHeaderClassNames={() => 'fc-pastel-header'}
        buttonText={{ today: 'היום' }}
      />
      {/* Edit/Add Modal */}
      {editEvent && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#0006', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 36, borderRadius: 12, minWidth: 340, boxShadow: '0 2px 16px #0002', maxWidth: 400 }}>
            <h3 style={{ marginBottom: 18, fontWeight: 600, fontSize: 20 }}>{editEvent.isNew ? 'הוסף משימה' : 'עריכת משימה'}</h3>
            {/* Done and Message Sent toggles */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
              <button
                onClick={() => setEditFields(f => ({ ...f, done: !f.done }))}
                style={{ background: editFields.done ? '#4caf50' : '#eee', color: editFields.done ? '#fff' : '#333', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 600, fontSize: 15, cursor: 'pointer', textDecoration: editFields.done ? 'line-through' : 'none' }}
              >{editFields.done ? '✔️ הושלם' : 'סמן כהושלם'}</button>
              <button
                onClick={() => setEditFields(f => ({ ...f, messageSent: !f.messageSent }))}
                style={{ background: editFields.messageSent ? '#111' : '#eee', color: editFields.messageSent ? '#fff' : '#333', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
              >{editFields.messageSent ? '✉️ הודעה נשלחה' : 'סמן הודעה נשלחה'}</button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontWeight: 500 }}>כותרת:</label>
              <input value={editFields.title} onChange={e => setEditFields(f => ({ ...f, title: e.target.value }))} style={{ width: '100%', border: '1px solid #e0e0e0', borderRadius: 6, padding: 6, marginTop: 4, fontSize: 15 }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontWeight: 500 }}>תיאור:</label>
              <input value={editFields.subtitle} onChange={e => setEditFields(f => ({ ...f, subtitle: e.target.value }))} style={{ width: '100%', border: '1px solid #e0e0e0', borderRadius: 6, padding: 6, marginTop: 4, fontSize: 15 }} />
            </div>
            <div style={{ marginBottom: 14, display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontWeight: 500 }}>קטגוריה:</label>
                <select value={editFields.category} onChange={e => setEditFields(f => ({ ...f, category: e.target.value }))} style={{ width: '100%', border: '1px solid #e0e0e0', borderRadius: 6, padding: 6, marginTop: 4, fontSize: 15 }}>
                  {taskCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontWeight: 500 }}>עדיפות:</label>
                <select value={editFields.priority} onChange={e => setEditFields(f => ({ ...f, priority: e.target.value }))} style={{ width: '100%', border: '1px solid #e0e0e0', borderRadius: 6, padding: 6, marginTop: 4, fontSize: 15 }}>
                  {taskPriorities.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 14, display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontWeight: 500 }}>מוקצה ל:</label>
                <select value={editFields.assignTo} onChange={e => setEditFields(f => ({ ...f, assignTo: e.target.value }))} style={{ width: '100%', border: '1px solid #e0e0e0', borderRadius: 6, padding: 6, marginTop: 4, fontSize: 15 }}>
                  {users.map(u => (
                    <option key={u.id} value={u.email}>{u.alias ? u.alias : u.email}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 14, display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontWeight: 500 }}>תאריך:</label>
                <input type="date" value={editFields.date} onChange={e => setEditFields(f => ({ ...f, date: e.target.value }))} style={{ width: '100%', border: '1px solid #e0e0e0', borderRadius: 6, padding: 6, marginTop: 4, fontSize: 15 }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontWeight: 500 }}>שעה:</label>
                <input type="time" value={editFields.time} onChange={e => setEditFields(f => ({ ...f, time: e.target.value }))} style={{ width: '100%', border: '1px solid #e0e0e0', borderRadius: 6, padding: 6, marginTop: 4, fontSize: 15 }} />
              </div>
            </div>
            {editEvent && editEvent.type === 'task' && (
              <div style={{ marginTop: 18, borderTop: '1px solid #eee', paddingTop: 12 }}>
                <div style={{ fontWeight: 500, marginBottom: 6 }}>תגובות:</div>
                <div style={{ maxHeight: 120, overflowY: 'auto', marginBottom: 8 }}>
                  {(editEvent.replies && editEvent.replies.length > 0) ? (
                    editEvent.replies.map((reply, idx) => (
                      <div key={reply.id || idx} style={{ fontSize: 13, marginBottom: 4, background: '#f6f8fa', borderRadius: 6, padding: '4px 8px' }}>
                        <span style={{ fontWeight: 600 }}>{reply.userAlias || reply.userEmail || 'משתמש'}</span>
                        <span style={{ color: '#888', fontSize: 11, marginRight: 6 }}>{formatDateTime(reply.timestamp)}</span>
                        <div style={{ marginTop: 2 }}>{reply.text}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: '#aaa', fontSize: 13 }}>אין תגובות עדיין.</div>
                  )}
                </div>
                <form onSubmit={e => { e.preventDefault(); handleTaskReply(editEvent.id, replyText); }} style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="הוסף תגובה..."
                    style={{ flex: 1, border: '1px solid #e0e0e0', borderRadius: 6, padding: 6, fontSize: 14 }}
                  />
                  <button type="submit" style={{ background: '#b5ead7', color: '#222', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>שלח</button>
                </form>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button onClick={() => setEditEvent(null)} style={{ background: '#eee', color: '#333', border: 'none', borderRadius: 6, padding: '6px 18px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>ביטול</button>
              <button
                onClick={editEvent.isNew ? handleAddNew : () => {
                  setEvents(prev => prev.map(ev => ev.id === editEvent.id ? { ...editFields, id: editEvent.id } : ev));
                  setEditEvent(null);
                }}
                style={{ background: '#a7c7e7', color: '#222', border: 'none', borderRadius: 6, padding: '6px 18px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
              >{editEvent.isNew ? 'הוסף' : 'שמור'}</button>
            </div>
          </div>
        </div>
      )}
      {/* Custom styles for FullCalendar navigation buttons */}
      <style jsx global>{`
        .fc .fc-button, .fc .fc-button-primary {
          background: #bee4e5 !important;
          color: #222 !important;
          border: none !important;
          border-radius: 8px !important;
          font-weight: 600;
          font-size: 16px;
          box-shadow: none !important;
          margin: 0 2px;
          min-width: 44px;
          min-height: 44px;
          transition: background 0.2s;
        }
        .fc .fc-button:hover, .fc .fc-button-primary:hover {
          background: #eaccd8 !important;
        }
        .fc .fc-button-active, .fc .fc-button-primary:active {
          background: #c8c7ef !important;
        }
        .fc .fc-today-button {
          background: #a7c7e7 !important;
          color: #222 !important;
        }
        .fc .fc-toolbar-title {
          font-size: 22px;
          font-weight: 700;
          color: #3b3b3b;
        }
        .fc-pastel-header {
          background: #f8fafc !important;
          color: #444 !important;
        }
      `}</style>
    </div>
  );
} 