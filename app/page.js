// Version 7.8 - Added persistence to TaskManager filter (defaulted to "My Tasks") and extended lead status automation for info@dradamwinter.com
"use client";

// Utility functions for layout persistence
function saveLayoutPref(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) { /* ignore */ }
}
function getLayoutPref(key, defaultValue) {
  try {
    const val = localStorage.getItem(key);
    if (val !== null) return JSON.parse(val);
  } catch (e) { /* ignore */ }
  return defaultValue;
}
import '@fontsource/rubik/300.css';
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/500.css';
import '@fontsource/rubik/700.css';
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Image from 'next/image';
import { useRouter } from "next/navigation";
import { auth, db } from "../firebase";
import { FaWhatsapp, FaCodeBranch } from "react-icons/fa";
import { or, query, where, orderBy, arrayUnion } from "firebase/firestore";
import { useAuth } from "./context/AuthContext";  // Updated import path
import { useData } from "./context/DataContext";
import FullCalendarDemo from "../components/FullCalendarDemo";
// ואז ברנדר:
// <FullCalendarDemo />
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, RotateCcw, Bell, ChevronDown, Pencil, MessageCircle, Check, X, ChevronLeft, Sunrise, Sun, Sunset, MoonStar } from 'lucide-react';
import NotesAndLinks from "@/components/NotesAndLinks";
import TaskManager from "@/components/TaskManager";
import LeadManager from "@/components/LeadManager";
import FixedTasks from "@/components/FixedTasks";
import FixedTasksAnalytics from "@/components/FixedTasksAnalytics";
import { logActivity } from "@/lib/activityLogger";
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  onSnapshot,
  setDoc,
  doc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import axios from "axios";
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
import { horizontalListSortingStrategy } from "@dnd-kit/sortable";
import SortableCategoryColumn from "../components/ui/sortable-category-column";
import SortableItem from "../components/ui/sortable-item";
//CandidatesBlock
import CandidatesBlock from "../components/CandidatesBlock";

import moment from 'moment-timezone';
import 'moment/locale/he';

import { momentLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  Area,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from 'recharts';


import { useToast } from "@/components/ui/use-toast"

// Add to imports
import { TaskTabs } from "@/components/TaskTabs";

// Add this import at the top with other imports
import { Switch as MuiSwitch } from '@mui/material';
import { styled } from '@mui/material/styles';
import { createUserWithEmailAndPassword } from "firebase/auth";
import AddUserDialog from "@/components/AddUserDialog";
import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers';
import UserManagement from "@/components/UserManagement";
import CallLogDashboard from "@/components/CallLogDashboard";

// Add this styled component definition before the Dashboard component
const IOSSwitch = styled((props) => (
  <MuiSwitch focusVisibleClassName=".Mui-focusVisible" disableRipple {...props} />
))(({ theme }) => ({
  width: 42,
  height: 26,
  padding: 0,
  '& .MuiSwitch-switchBase': {
    padding: 0,
    margin: 2,
    transitionDuration: '300ms',
    '&.Mui-checked': {
      transform: 'translateX(16px)',
      color: '#fff',
      '& + .MuiSwitch-track': {
        backgroundColor: '#2196f3',
        opacity: 1,
        border: 0,
      },
      '&.Mui-disabled + .MuiSwitch-track': {
        opacity: 0.5,
      },
    },
    '&.Mui-focusVisible .MuiSwitch-thumb': {
      color: '#33cf4d',
      border: '6px solid #fff',
    },
    '&.Mui-disabled .MuiSwitch-thumb': {
      color: '#E9E9EA',
    },
    '&.Mui-disabled + .MuiSwitch-track': {
      opacity: 0.7,
    },
  },
  '& .MuiSwitch-thumb': {
    boxSizing: 'border-box',
    width: 22,
    height: 22,
  },
  '& .MuiSwitch-track': {
    borderRadius: 26 / 2,
    backgroundColor: '#E9E9EA',
    opacity: 1,
    transition: 'background-color 500ms',
  },
}));

/*
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, query, where, orderBy, onSnapshot, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, Timestamp, arrayUnion } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
*/


/*
const firebaseConfig = {
  apiKey: "AIzaSyBVIjO_f5GKTal8xpG-QA7aLtWX2A9skoI",
  authDomain: "crm-dashboard-2db5f.firebaseapp.com",
  projectId: "crm-dashboard-2db5f",
  storageBucket: "crm-dashboard-2db5f.appspot.com",
  messagingSenderId: "668768143823",
  appId: "1:668768143823:web:ab8619b6ccb90de97e6aba"
};
let app;
if (!getApps().length) { app = initializeApp(firebaseConfig); } else { app = getApp(); }
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
*/


function isTaskOverdue(task) {
  if (task.done) return false;
  const now = new Date();
  const due = new Date(task.dueDate);
  return due < now;
}
function isTaskOverdue12h(task) {
  if (!task || task.done || !task.dueDate) return false;
  const now = new Date();
  const due = new Date(task.dueDate);
  const twelveHours = 12 * 60 * 60 * 1000;
  return now - due > 0 && now - due <= twelveHours;
}
const todayAt = (h, m) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};
const formatDateTime = (date) => {
  if (!date) return "";
  try {

    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return `${d.toLocaleDateString("he-IL")} ${d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  } catch (error) { console.error("Error formatting date:", date, error); return ""; }

};

const formatDuration = (ms) => {
  if (typeof ms !== 'number' || ms < 0 || isNaN(ms)) return "";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} ${days === 1 ? 'יום' : 'ימים'}`;
  if (hours > 0) return `${hours} ${hours === 1 ? 'שעה' : 'שעות'}`;
  if (minutes > 0) return `${minutes} ${minutes === 1 ? 'דקה' : 'דקות'}`;
  return "< דקה";
};

moment.locale('he');
moment.tz.setDefault("Asia/Jerusalem");
const localizer = momentLocalizer(moment);
const messages = { allDay: "כל היום", previous: "הקודם", next: "הבא", today: "היום", month: "חודש", week: "שבוע", day: "יום", agenda: "סדר יום", date: "תאריך", time: "זמן", event: "אירוע", noEventsInRange: "אין אירועים בטווח זה", showMore: (total) => `+ ${total} נוספים`, };


// Updated lead statuses and colors (order matters)
const leadStatusConfig = { "חדש": { color: "bg-red-500", priority: 1 }, "נקבעה שיחה": { color: "bg-pink-500", priority: 2 }, "בבדיקת לקוח": { color: "bg-orange-500", priority: 2 }, "ממתין לתשובה של ד״ר וינטר": { color: "bg-purple-500", priority: 3 }, "נקבע יעוץ": { color: "bg-green-500", priority: 4 }, "בסדרת טיפולים": { color: "bg-emerald-400", priority: 6 }, "באג": { color: "bg-yellow-900", priority: 5 }, "לא מתאים": { color: "bg-gray-400", priority: 7 }, "אין מענה": { color: "bg-yellow-500", priority: 5 }, "קורס": { color: "bg-blue-900", priority: 8 }, "ניתן מענה": { color: "bg-gray-500", priority: 9 }, "Default": { color: "bg-gray-300", priority: 99 } };
const leadColorTab = (status) => leadStatusConfig[status]?.color || leadStatusConfig.Default.color;
const leadPriorityValue = (status) => leadStatusConfig[status]?.priority || leadStatusConfig.Default.priority;


// Add after user state declarations:





const taskPriorities = ["דחוף", "רגיל", "נמוך"];








export default function Dashboard() {
  const defaultTaskCategories = ["תוכניות טיפול", "לקבוע סדרה", "תשלומים וזיכויים", "דוחות", "להתקשר", "אחר"];
  const [taskCategories, setTaskCategories] = useState(defaultTaskCategories);

  const { currentUser } = useAuth();
  const { tasks, setTasks, leads, setLeads, users, assignableUsers, currentUserData } = useData();
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const role = currentUserData?.role || "";
  const alias = currentUserData?.alias || "";
  const userExt = currentUserData?.EXT || "";
  // Single tasks state declaration
  const [replyingToTaskId, setReplyingToTaskId] = useState(null);
  const [showOverdueEffects, setShowOverdueEffects] = useState(true);
  const [replyInputValue, setReplyInputValue] = useState("");
  // --- Add Kanban collapsed state ---
  const [kanbanCollapsed, setKanbanCollapsed] = useState({});
  // --- Add per-task collapsed state ---
  const [kanbanTaskCollapsed, setKanbanTaskCollapsed] = useState({});
  // Add this state for lead Task
  const [leadTaskText, setLeadTaskText] = useState("");
  const [leadTaskAssignTo, setLeadTaskAssignTo] = useState("");
  const [leadTaskCategory, setLeadTaskCategory] = useState("");
  const [leadTaskDueDate, setLeadTaskDueDate] = useState("");
  const [leadTaskDueTime, setLeadTaskDueTime] = useState("");
  const [showFunnel, setShowFunnel] = useState(false); // State to control funnel visibility
  const [showTimeline, setShowTimeline] = useState(false); // State to control timeline visibility
  const [fixedTasksVisible, setFixedTasksVisible] = useState(() => getLayoutPref('dashboard_fixedTasksVisible', true)); // State to control fixed tasks visibility

  // Add this handler for category drag end
  const handleCategoryDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = taskCategories.indexOf(active.id);
    const newIndex = taskCategories.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(taskCategories, oldIndex, newIndex);
    updateKanbanCategoryOrder(newOrder);
  };
  const handleCreateTaskFromLead = async (lead) => {
    if (!leadTaskText.trim() || !leadTaskAssignTo || !leadTaskCategory || !leadTaskDueDate) return;

    console.log('Creating task from lead:', lead);

    try {
      const assignedUser = assignableUsersWithSelf.find(u => u.alias === leadTaskAssignTo || u.email === leadTaskAssignTo);
      const taskRef = doc(collection(db, "tasks"));
      await setDoc(taskRef, {
        id: taskRef.id,
        userId: currentUser.uid,
        creatorId: currentUser.uid,
        creatorAlias: alias || currentUser.email || "",
        title: lead.fullName,
        subtitle: `${leadTaskText} | טלפון: ${lead.phoneNumber}`,
        assignTo: assignedUser ? assignedUser.email : leadTaskAssignTo,
        category: leadTaskCategory,
        status: "פתוח",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        dueDate: leadTaskDueDate && leadTaskDueTime
          ? new Date(`${leadTaskDueDate}T${leadTaskDueTime}`).toISOString()
          : new Date(leadTaskDueDate).toISOString(),
        replies: [],
        isRead: false,
        isArchived: false,
        done: false,
        completedBy: null,
        completedAt: null,
        leadId: lead.id // <-- Add this line
      });
      setLeadTaskText("");
      setLeadTaskAssignTo("");
      setLeadTaskCategory("להתקשר");
      setLeadTaskDueDate("");
      setLeadTaskDueTime("");
      toast({ title: "המשימה נוצרה בהצלחה" });
    } catch (error) {
      alert("שגיאה ביצירת משימה");
    }
  };
  const handleClick2Call = async (phoneNumber) => {
    // Detect mobile phone (not tablets)
    const isMobilePhone = /iPhone|Android/i.test(navigator.userAgent) &&
      !/iPad|tablet/i.test(navigator.userAgent) &&
      window.matchMedia("(max-width: 480px)").matches;

    // Strip # prefix if present
    const cleanNumber = phoneNumber.replace(/^#/, '');

    // Mobile fallback: use tel: link with callback system
    if (isMobilePhone && !userExt) {
      const localCallbackNumber = "0723911351";
      const defaultExt = "101#";
      const passcode = "3636#";
      const telLink = `tel:${localCallbackNumber},${defaultExt},${passcode},${cleanNumber}`;
      window.location.href = telLink;
      return;
    }

    // Desktop or user with EXT: use PBX API
    if (!userExt) {
      toast({
        title: "לא מוגדר שלוחה",
        description: "לא הוגדרה שלוחה (EXT) למשתמש זה. פנה למנהל המערכת.",
        variant: "destructive"
      });
      return;
    }

    const apiUrl = "/api/click2call";
    const payload = {
      phone_number: cleanNumber,
      extension_number: userExt
    };
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        toast({
          title: "התקשרות מתבצעת",
          description: `שיחה ל-${cleanNumber} הופעלה דרך המרכזיה.`
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "שגיאה בהפעלת שיחה",
          description: errorData.details || errorData.error || "לא ניתן היה להפעיל שיחה דרך המרכזיה.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "שגיאה בהפעלת שיחה",
        description: error.message || "לא ניתן היה להפעיל שיחה דרך המרכזיה.",
        variant: "destructive"
      });
    }
  };
  // --- Add Kanban collapse/expand handler ---
  const handleToggleKanbanCollapse = async (category) => {
    setKanbanCollapsed((prev) => {
      const updated = { ...prev, [category]: !prev[category] };
      // Persist to Firestore
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        updateDoc(userRef, { kanbanCollapsed: updated });
      }
      return updated;
    });
  };
  // Fetch and listen for user's Kanban category order from Firestore
  useEffect(() => {
    if (!currentUser) return;
    const userRef = doc(db, 'users', currentUser.uid);
    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.kanbanCategoryOrder) && data.kanbanCategoryOrder.length > 0) {
          setTaskCategories(data.kanbanCategoryOrder);
        } else {
          setTaskCategories(defaultTaskCategories);
        }
      }
    });
    return () => unsubscribe();
  }, [currentUser]);

  // --- Follow-up phone icon logic ---
  const handleFollowUpClick = async (lead) => {
    if (!currentUser) return;
    if (holdLeadId === lead.id) return;
    // Only activate if not already active and count is 0
    if (!lead.followUpCall?.active && (!lead.followUpCall || lead.followUpCall.count === 0)) {
      const leadRef = doc(db, 'leads', lead.id);
      await updateDoc(leadRef, { followUpCall: { active: true, count: 1 } });
    } else if (lead.followUpCall?.active) {
      const leadRef = doc(db, 'leads', lead.id);
      await updateDoc(leadRef, { followUpCall: { active: true, count: (lead.followUpCall.count || 1) + 1 } });
    }
  };

  const handleFollowUpReset = async (lead) => {
    if (!currentUser) return;
    const leadRef = doc(db, 'leads', lead.id);
    await updateDoc(leadRef, { followUpCall: { active: false, count: 0 } });
    // Minimal delay to show completed ring, then clear
    setTimeout(() => {
      setHoldLeadId(null);
      setHoldProgress(0);
    }, 50);
  };

  // --- Hold handlers for the button ---
  const holdDelayTimeout = useRef();

  const handleHoldStart = (lead) => {
    setHoldLeadId(lead.id);
    setHoldProgress(0);
    // Start a 0.3-second delay before animating
    holdDelayTimeout.current = setTimeout(() => {
      const start = Date.now();
      function animate() {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / 1200, 1); // 1.2s animation
        setHoldProgress(progress);
        if (progress < 1) {
          holdAnimationRef.current = requestAnimationFrame(animate);
        } else {
          handleFollowUpReset(lead);
        }
      }
      holdAnimationRef.current = requestAnimationFrame(animate);
    }, 300); // 0.3s delay before animation
  };

  const handleHoldEnd = () => {
    setHoldLeadId(null);
    setHoldProgress(0);
    if (holdDelayTimeout.current) clearTimeout(holdDelayTimeout.current);
    if (holdAnimationRef.current) cancelAnimationFrame(holdAnimationRef.current);
  };
  const BRANCHES = [
    { value: '', label: 'ללא סניף', color: 'bg-gray-200 text-gray-700' },
    { value: 'רעננה', label: 'רעננה', color: 'bg-green-200 text-green-800' },
    { value: 'מודיעין', label: 'מודיעין', color: 'bg-blue-200 text-blue-800' },
  ];

  const branchColor = (branch) => {
    const found = BRANCHES.find(b => b.value === branch);
    return found ? found.color : 'bg-gray-200 text-gray-700';
  };
  const [holdLeadId, setHoldLeadId] = useState(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdAnimationRef = useRef();
  const HOLD_DURATION = 1500;
  const [expandedLeadId, setExpandedLeadId] = useState(null);
  // When lead status changes, reset followUpCall
  const handleStatusChange = async (leadId, newStatus) => {
    if (!leadId || !newStatus) return;
    try {
      const leadRef = doc(db, "leads", leadId);
      await updateDoc(leadRef, {
        status: newStatus,
        isHot: false
      });
    } catch (error) {
      console.error("Error updating lead status:", error);
    }
  };
  // Function to update Kanban category order in Firestore
  const updateKanbanCategoryOrder = async (newOrder) => {
    setTaskCategories(newOrder);
    if (currentUser) {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, { kanbanCategoryOrder: newOrder });
    }
  };
  // --- Fetch per-task collapsed state from Firestore ---
  useEffect(() => {
    if (!currentUser) return;
    const fetchTaskCollapsed = async () => {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setKanbanTaskCollapsed(data.kanbanTaskCollapsed || {});
        }
      } catch (e) {
        setKanbanTaskCollapsed({});
      }
    };
    fetchTaskCollapsed();
  }, [currentUser]);

  // --- Handler for per-task collapse/expand ---
  const handleToggleTaskCollapse = async (taskId) => {
    setKanbanTaskCollapsed((prev) => {
      const updated = { ...prev, [taskId]: !prev[taskId] };
      // Persist to Firestore
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        updateDoc(userRef, { kanbanTaskCollapsed: updated });
      }
      return updated;
    });
  };

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !currentUser) {
      router.push("/login");
      return;
    }
    setLoading(false);
  }, [loading, currentUser, router]);

  // ✅ 1. Listen to auth state changes - REMOVED duplicate listener since we use AuthContext
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
    }
  }, [currentUser]);

  // ✅ 2. Redirect after auth check
  useEffect(() => {
    if (!loading && !currentUser) {
      router.push("/login");
    }
  }, [loading, currentUser, router]);

  // ✅ 3. Optional loading screen (handled in return)

  const handleAliasUpdate = async (newAlias) => {
    console.log("Clicked save alias. Current alias:", newAlias);
    if (!currentUser) return;
    const ref = doc(db, "users", currentUser.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await setDoc(ref, {
        email: currentUser.email,
        alias: newAlias,
        role: "staff", // Default role for new users
        createdAt: new Date()
      });
    } else {
      await updateDoc(ref, {
        alias: newAlias
      });
    }
    // Trigger a refetch by updating the context - the useEffect in DataContext will handle this
  };

  const [justClosedLeadId, setJustClosedLeadId] = useState(null);
  const justClosedLeadIdRef = useRef(null);
  const closeLeadId = (leadId) => {
    setJustClosedLeadId(leadId);
    justClosedLeadIdRef.current = leadId;
  };
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState("month");
  const [isFullView, setIsFullView] = useState(() => getLayoutPref('dashboard_isFullView', false));
  const [mounted, setMounted] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState('');
  const [greeting, setGreeting] = useState({ message: 'שלום', period: 'morning' });
  const defaultBlockOrder = { TM: 1, Calendar: 2, Leads: 3 };
  const greetingIconMap = useMemo(() => ({
    morning: Sunrise,
    afternoon: Sun,
    evening: Sunset,
    night: MoonStar,
  }), []);
  const greetingColorMap = useMemo(() => ({
    morning: 'text-amber-500',
    afternoon: 'text-yellow-500',
    evening: 'text-orange-500',
    night: 'text-indigo-400',
  }), []);
  const [blockOrder, setBlockOrder] = useState(() => getLayoutPref('dashboard_blockOrder', defaultBlockOrder));
  const [taskCalendarData, setTaskCalendarData] = useState({ events: [], users: [], taskCategories: [] });
  const [leadCalendarData, setLeadCalendarData] = useState({ events: [] });



  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnTaskId, setReturnTaskId] = useState(null);
  const [returnComment, setReturnComment] = useState("");
  const [returnNewAssignee, setReturnNewAssignee] = useState("");
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [newLeadFullName, setNewLeadFullName] = useState("");
  const [newLeadPhone, setNewLeadPhone] = useState("");
  const [newLeadMessage, setNewLeadMessage] = useState("");
  const [newLeadStatus, setNewLeadStatus] = useState("חדש");
  const [newLeadSource, setNewLeadSource] = useState("");
  const [newLeadIsHot, setNewLeadIsHot] = useState(true);

  const [taskFilter, setTaskFilter] = useState("הכל");
  const [taskPriorityFilter, setTaskPriorityFilter] = useState("all");
  const [selectedTaskCategories, setSelectedTaskCategories] = useState(() => defaultTaskCategories);
  const [taskSearchTerm, setTaskSearchTerm] = useState("");
  const [isTMFullView, setIsTMFullView] = useState(() => getLayoutPref('dashboard_isTMFullView', false));
  const [showDoneTasks, setShowDoneTasks] = useState(false);
  const [userHasSortedTasks, setUserHasSortedTasks] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingAssignTo, setEditingAssignTo] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [editingSubtitle, setEditingSubtitle] = useState("");
  const [editingPriority, setEditingPriority] = useState("רגיל");
  const [editingCategory, setEditingCategory] = useState(taskCategories[0] || "");
  const [editingDueDate, setEditingDueDate] = useState("");
  const [editingDueTime, setEditingDueTime] = useState("");
  const [editingBranch, setEditingBranch] = useState("");
  const [isLeadsFullView, setIsLeadsFullView] = useState(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem('dashboard_isLeadsFullView');
      return v ? JSON.parse(v) : false;
    }
    return false;
  });
  useEffect(() => {
    localStorage.setItem('dashboard_isLeadsFullView', JSON.stringify(isLeadsFullView));
  }, [isLeadsFullView]);
  // Add task creation state variables
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskSubtitle, setNewTaskSubtitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("רגיל");
  const [newTaskCategory, setNewTaskCategory] = useState(taskCategories[0] || "");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskDueTime, setNewTaskDueTime] = useState("");
  const [newTaskAssignTo, setNewTaskAssignTo] = useState("");
  const [newTaskBranch, setNewTaskBranch] = useState("");

  // Ensure current user is always in the assignable users list
  const assignableUsersWithSelf = useMemo(() => {
    if (!currentUser) return assignableUsers;

    // Check if current user is already in the list
    const isCurrentUserInList = assignableUsers.some(
      u => u.id === currentUser.uid || u.email === currentUser.email
    );

    if (isCurrentUserInList) {
      return assignableUsers;
    }

    // Add current user to the list
    const currentUserObj = {
      id: currentUser.uid,
      email: currentUser.email,
      alias: alias || currentUser.email,
      role: role || "staff"
    };

    return [currentUserObj, ...assignableUsers];
  }, [assignableUsers, currentUser, alias, role]);

  // First, add a new state for showing the new task form


  // Add state for duplicate confirmation dialog
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [leadToDuplicate, setLeadToDuplicate] = useState(null);

  // Add state for calendar full view
  const [isCalendarFullView, setIsCalendarFullView] = useState(() => getLayoutPref('dashboard_isCalendarFullView', false));
  const [isCalendarVisible, setIsCalendarVisible] = useState(() => getLayoutPref('dashboard_isCalendarVisible', true));

  // Persist calendar full view preference
  useEffect(() => {
    saveLayoutPref('dashboard_isCalendarFullView', isCalendarFullView);
  }, [isCalendarFullView]);

  useEffect(() => {
    saveLayoutPref('dashboard_isCalendarVisible', isCalendarVisible);
  }, [isCalendarVisible]);

  // Persist fixed tasks visibility preference
  useEffect(() => {
    saveLayoutPref('dashboard_fixedTasksVisible', fixedTasksVisible);
  }, [fixedTasksVisible]);

  // Handler to toggle fixed tasks visibility
  const toggleFixedTasksVisibility = useCallback(() => {
    setFixedTasksVisible(prev => !prev);
  }, []);

  // Persist task manager full view preference
  useEffect(() => {
    saveLayoutPref('dashboard_isTMFullView', isTMFullView);
  }, [isTMFullView]);

  // Persist block order preference
  useEffect(() => {
    saveLayoutPref('dashboard_blockOrder', blockOrder);
  }, [blockOrder]);

  // Persist TM block size and Leads block size to Firestore
  useEffect(() => {
    if (!currentUser) return;
    const userRef = doc(db, 'users', currentUser.uid);
    updateDoc(userRef, {
      tm_isFullView: isTMFullView,
      leads_isFullView: isFullView,
      updatedAt: serverTimestamp(),
    }).catch(() => { });
  }, [currentUser, isTMFullView, isFullView]);

  // Persist lead manager full view preference
  useEffect(() => {
    saveLayoutPref('dashboard_isFullView', isFullView);
  }, [isFullView]);

  // Update task creation to use consistent user identifiers
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      console.error("No current user found");
      return;
    }

    try {
      // Find the assigned user's details
      const assignedUser = assignableUsersWithSelf.find(u =>
        u.alias === newTaskAssignTo ||
        u.email === newTaskAssignTo
      );

      console.log("Creating task with assignment:", {
        assignTo: newTaskAssignTo,
        foundUser: assignedUser
      });

      // If no date/time provided, use current date/time
      let dueDateTime;
      if (newTaskDueDate && newTaskDueTime) {
        dueDateTime = new Date(`${newTaskDueDate}T${newTaskDueTime}`).toISOString();
      } else if (newTaskDueDate) {
        // Date provided but no time - use date with current time
        const now = new Date();
        dueDateTime = new Date(`${newTaskDueDate}T${now.toTimeString().slice(0, 5)}`).toISOString();
      } else {
        // No date provided - use current date and time
        dueDateTime = new Date().toISOString();
      }

      const taskRef = doc(collection(db, "tasks"));
      const newTask = {
        id: taskRef.id,
        userId: currentUser.uid,
        creatorId: currentUser.uid,
        title: newTaskTitle,
        subtitle: newTaskSubtitle,
        priority: newTaskPriority,
        category: newTaskCategory,
        status: "פתוח",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        creatorAlias: alias || currentUser.email || "",
        // Use the most specific identifier available
        assignTo: assignedUser ? assignedUser.email : newTaskAssignTo,
        dueDate: dueDateTime,
        replies: [],
        isRead: false,
        isArchived: false,
        done: false,
        completedBy: null,
        completedAt: null,
        branch: newTaskBranch,
      };

      console.log("Saving task with data:", newTask);
      await setDoc(taskRef, newTask);

      // Reset form
      setNewTaskTitle("");
      setNewTaskSubtitle("");
      setNewTaskPriority("רגיל");
      setNewTaskCategory(taskCategories[0] || "");
      setNewTaskDueDate("");
      setNewTaskDueTime("");
      setNewTaskAssignTo("");
      setShowTaskModal(false);
      setNewTaskBranch('');
    } catch (error) {
      console.error("Error creating task:", error);
      alert("שגיאה ביצירת המשימה. נסה שוב.");
    }
  };

  /**
   * Centralized function to create any task in Firestore.
   * @param {object} taskData - The data for the task to be created.
   */
  const createTask = async (taskData) => {
    try {
      const taskRef = doc(collection(db, "tasks"));
      const newTask = {
        id: taskRef.id,
        status: "פתוח",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        replies: [],
        isRead: false,
        isArchived: false,
        done: false,
        completedBy: null,
        completedAt: null,
        ...taskData, // Spread the provided task data
      };

      console.log("Saving new task with final data:", newTask);
      await setDoc(taskRef, newTask);
      return newTask; // Return the created task
    } catch (error) {
      console.error("Error in central createTask function:", error);
      alert("שגיאה ביצירת המשימה.");
      return null;
    }
  };

  /**
   * "Shortcut" function to create a specific task for a new treatment plan.
   * @param {object} lead - The lead object from CandidatesBlock.
   */
  const createAutomatedTreatmentTask = async (lead) => {
    if (!currentUser) {
      console.error("Cannot create automated task without a user.");
      return;
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    const taskData = {
      userId: lead.id,
      creatorId: currentUser.uid,
      title: lead.fullName,
      subtitle: `נוצר מליד: ${lead.fullName} | טלפון: ${lead.phoneNumber}`,
      assignTo: "dradamwinter@gmail.com",
      category: "תוכניות טיפול",
      priority: "רגיל",
      branch: lead.branch || "",
      creatorAlias: alias || currentUser.email || "",
      dueDate: dueDate.toISOString(),
    };

    await createTask(taskData);
  };

  const handleTaskReply = async (taskId, replyText) => {
    if (!replyText.trim() || !currentUser) {
      console.log("Empty reply or no user, skipping");
      return;
    }

    try {
      const taskRef = doc(db, 'tasks', taskId);
      const taskDoc = await getDoc(taskRef);

      if (!taskDoc.exists()) {
        console.error('Task not found');
        return;
      }

      const taskData = taskDoc.data();

      // Check if user has permission to reply
      const hasPermission =
        taskData.userId === currentUser.uid ||
        taskData.creatorId === currentUser.uid ||
        taskData.assignTo === currentUser.uid ||
        taskData.assignTo === currentUser.email ||
        taskData.assignTo === alias;

      if (!hasPermission) {
        console.error('No permission to reply to this task', {
          taskAssignTo: taskData.assignTo,
          currentUserUid: currentUser.uid,
          currentUserEmail: currentUser.email,
          alias: alias
        });
        alert('אין לך הרשאה להוסיף תגובה למשימה זו');
        return;
      }

      const now = new Date();

      // Create the new reply object with a regular timestamp
      const newReply = {
        id: `reply-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: replyText,
        timestamp: now,
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userAlias: alias || currentUser.email,
        isRead: false
      };

      // Get existing replies
      const existingReplies = taskData.replies || [];

      // Update all fields in a single operation to match the rules
      await updateDoc(taskRef, {
        // Preserve existing core fields exactly as they are
        userId: taskData.userId,
        creatorId: taskData.creatorId,
        assignTo: taskData.assignTo,

        // Update reply-related fields
        replies: [...existingReplies, newReply],
        hasNewReply: true,
        lastReplyAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Update local state
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId
            ? {
              ...task,
              replies: [...(task.replies || []), newReply],
              hasNewReply: true,
              lastReplyAt: now
            }
            : task
        )
      );

      // Clear reply input
      setReplyingToTaskId(null);

      console.log('Reply added successfully to task:', taskId);
    } catch (error) {
      console.error('Error adding reply:', error, {
        taskId,
        currentUser: currentUser?.email,
        alias
      });
      alert('שגיאה בהוספת תגובה');
    }
  };
  // Add state to track which lead is being confirmed for deletion
  const [confirmingDeleteLeadId, setConfirmingDeleteLeadId] = useState(null);
  // ... existing code ...
  // Update handleDeleteLead to remove window.confirm and use inline confirmation
  const handleDeleteLead = async (leadId) => {
    if (!(currentUser?.role === "admin" || role === "admin")) {
      alert("רק אדמין יכול למחוק לידים");
      return;
    }
    // Only delete if confirmingDeleteLeadId matches
    if (confirmingDeleteLeadId !== leadId) {
      setConfirmingDeleteLeadId(leadId);
      return;
    }
    try {
      await deleteDoc(doc(db, "leads", leadId));
      toast({ title: "הליד נמחק", description: "הליד הוסר מהמערכת." });
      setConfirmingDeleteLeadId(null);
    } catch (error) {
      console.error("שגיאה במחיקת ליד:", error);
      alert("שגיאה במחיקת ליד");
      setConfirmingDeleteLeadId(null);
    }
  };
  const handleDuplicateLead = async (lead) => {
    try {
      const duplicatedLead = {
        ...lead,
        fullName: lead.fullName + " משוכפל",
        createdAt: new Date(),
        isHot: true,
      };
      delete duplicatedLead.id;
      await addDoc(collection(db, "leads"), duplicatedLead);
      alert("הליד שוכפל");
    } catch (error) {
      alert("שגיאה בשכפול ליד");
    }
  };

  const handleConfirmDuplicate = async () => {
    if (!leadToDuplicate) return;

    try {
      // Prepare duplicated lead data
      const duplicatedLead = {
        ...leadToDuplicate,
        fullName: leadToDuplicate.fullName + " משוכפל", // Add 'משוכפל' to the name
        createdAt: new Date(), // New creation date
        expanded: false,
      };
      // Remove fields that should not be duplicated
      delete duplicatedLead.id;
      // Add to Firestore
      await addDoc(collection(db, "leads"), duplicatedLead);
      // No need to update local state, real-time listener will update leads
      toast({ title: "הליד שוכפל", description: "נוצר ליד חדש משוכפל." });
    } catch (error) {
      console.error("שגיאה בשכפול ליד:", error);
      alert("שגיאה בשכפול ליד. נסה שוב.");
    } finally {
      setShowDuplicateConfirm(false);
      setLeadToDuplicate(null);
    }
  };
  // ... existing code ...
  // In the expanded lead row and compact list, update the delete button:
  // Replace the delete button with inline confirmation if confirmingDeleteLeadId === lead.id
  // ... existing code ...
  // In the compact list, do the same for the delete icon button:
  // ... existing code ...

  const handleMarkReplyAsRead = async (taskId) => {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      const taskDoc = await getDoc(taskRef);

      if (!taskDoc.exists()) {
        console.error('Task not found');
        return;
      }

      const taskData = taskDoc.data();
      const updatedReplies = (taskData.replies || []).map(reply => ({
        ...reply,
        isRead: true
      }));

      await updateDoc(taskRef, {
        replies: updatedReplies,
        hasNewReply: false,
        updatedAt: serverTimestamp()
      });

      // Update local state
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId
            ? {
              ...task,
              replies: updatedReplies,
              hasNewReply: false
            }
            : task
        )
      );

    } catch (error) {
      console.error('Error marking reply as read:', error);
      alert('שגיאה בעדכון סטטוס תגובה');
    }
  };

  // Add this before the renderTask function
  const handleTaskDone = async (taskId, checked) => {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      const taskDoc = await getDoc(taskRef);
      if (!taskDoc.exists()) {
        console.error('Task not found');
        return;
      }
      const taskData = taskDoc.data();
      const now = new Date();
      // Use alias if available, fallback to email or assignTo
      const aliasToUse = alias || currentUser?.alias || currentUser?.email || taskData.assignTo || taskData.creatorAlias || taskData.creatorEmail || '';
      await updateDoc(taskRef, {
        done: checked,
        completedBy: checked ? (currentUser?.email || currentUser?.uid) : null,
        completedByAlias: checked ? aliasToUse : null,
        completedAt: checked ? now : null,
        updatedAt: serverTimestamp()
      });
      // Update local state
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId
            ? {
              ...task,
              done: checked,
              completedBy: checked ? (currentUser?.email || currentUser?.uid) : null,
              completedByAlias: checked ? aliasToUse : null,
              completedAt: checked ? now : null
            }
            : task
        ));
    } catch (error) {
      console.error('Error updating task status:', error);
      alert('שגיאה בעדכון סטטוס המשימה');
    }
  };

  const handleNudgeTask = async (taskId) => {
    if (!currentUser) return;

    try {
      const taskRef = doc(db, "tasks", taskId);
      const now = new Date();

      const newNudge = {
        timestamp: now,
        userId: currentUser.uid,
        userAlias: currentUser.alias || currentUser.email
      };

      // Get current task data
      const taskDoc = await getDoc(taskRef);
      const taskData = taskDoc.data();

      await updateDoc(taskRef, {
        nudges: arrayUnion(newNudge),
        lastNudgedAt: now,
        updatedAt: now
      });

      // Create a notification for the assignee
      if (taskData.assignTo !== currentUser.email) {
        const notificationRef = doc(collection(db, "notifications"));
        await setDoc(notificationRef, {
          type: 'task_nudge',
          taskId: taskId,
          taskTitle: taskData.title,
          senderId: currentUser.uid,
          senderAlias: currentUser.alias || currentUser.email,
          recipientId: taskData.assignTo,
          createdAt: now,
          isRead: false
        });
      }

      toast({
        title: "תזכורת נשלחה",
        description: "נשלחה תזכורת למשתמש המוקצה למשימה",
      });
    } catch (error) {
      console.error('Error sending nudge:', error);
      toast({
        title: "שגיאה",
        description: "לא ניתן היה לשלוח תזכורת",
        variant: "destructive"
      });
    }
  };

  // Update the task rendering to show replies
  const renderTask = (task) => {
    if (!task) {
      return (
        <div className="p-3 border rounded bg-blue-50 shadow-md">
          <form onSubmit={handleCreateTask} className="space-y-2">
            <div>
              <Label className="text-xs">מוקצה ל:</Label>
              <select
                value={newTaskAssignTo}
                onChange={(e) => setNewTaskAssignTo(e.target.value)}
                className="h-8 text-sm w-full border rounded"
              >
                <option value="">בחר משתמש</option>
                {assignableUsersWithSelf.map((user) => (
                  <option key={user.id} value={user.alias || user.email}>
                    {user.alias || user.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">כותרת:</Label>
              <Input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="h-8 text-sm"
                required
                onKeyDown={e => { if (e.key === ' ' || e.code === 'Space') e.stopPropagation(); }}
              />
            </div>
            <div>
              <Label className="text-xs">תיאור:</Label>
              <Textarea
                value={newTaskSubtitle}
                onChange={(e) => setNewTaskSubtitle(e.target.value)}
                rows={2}
                className="text-sm"
                onKeyDown={e => { if (e.key === ' ' || e.code === 'Space') e.stopPropagation(); }}
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-xs">עדיפות:</Label>
                <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {taskPriorities.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-xs">קטגוריה:</Label>
                <Select value={newTaskCategory} onValueChange={setNewTaskCategory}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {taskCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-xs">תאריך:</Label>
                <Input
                  type="date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs">שעה:</Label>
                <Input
                  type="time"
                  value={newTaskDueTime}
                  onChange={(e) => setNewTaskDueTime(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="flex-1">
              <Label className="text-xs">סניף:</Label>
              <Select value={newTaskBranch} onValueChange={setNewTaskBranch}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="בחר סניף..." />
                </SelectTrigger>
                <SelectContent>
                  {BRANCHES.filter(b => b.value).map(b => (
                    <SelectItem key={b.value} value={b.value}>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${b.color}`}>{b.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col items-center gap-2 pt-1">
              <Button type="submit" size="sm" className="bg-green-600 hover:bg-green-700 text-white px-12">{'צור משימה'}</Button>
              <Button
                type="button"
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white px-12"
                onClick={() => setShowTaskModal(false)}
              >
                {'ביטול'}
              </Button>
            </div>
          </form>
        </div>
      );
    }

    // If we're editing this task, show the edit form
    if (editingTaskId === task.id) {
      return (
        <div className="p-3 border rounded bg-blue-50 shadow-md">
          <form onSubmit={handleSaveTask} className="space-y-2">
            <div>
              <Label className="text-xs">מוקצה ל:</Label>
              <Select value={editingAssignTo} onValueChange={setEditingAssignTo}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="בחר משתמש" />
                </SelectTrigger>
                <SelectContent>
                  {assignableUsersWithSelf.map((user) => (
                    <SelectItem key={user.id} value={user.email}>
                      {user.alias || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">כותרת:</Label><Input type="text" value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} className="h-8 text-sm" required
              onKeyDown={e => { if (e.key === ' ' || e.code === 'Space') e.stopPropagation(); }}
            />
              <Textarea value={editingSubtitle} onChange={(e) => setEditingSubtitle(e.target.value)} rows={2} className="text-sm"
                onKeyDown={e => { if (e.key === ' ' || e.code === 'Space') e.stopPropagation(); }}
              /></div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-xs">עדיפות:</Label>
                <Select value={editingPriority} onValueChange={setEditingPriority}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{taskPriorities.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-xs">קטגוריה:</Label>
                <Select value={editingCategory} onValueChange={setEditingCategory}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{taskCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1"><Label className="text-xs">תאריך:</Label><Input type="date" value={editingDueDate} onChange={(e) => setEditingDueDate(e.target.value)} className="h-8 text-sm" required /></div>
              <div className="flex-1"><Label className="text-xs">שעה:</Label><Input type="time" value={editingDueTime} onChange={(e) => setEditingDueTime(e.target.value)} className="h-8 text-sm" /></div>
            </div>
            <div className="flex-1">
              <Label className="text-xs">סניף:</Label>
              <Select value={editingBranch} onValueChange={setEditingBranch}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="בחר סניף..." />
                </SelectTrigger>
                <SelectContent>
                  {BRANCHES.filter(b => b.value).map(b => (
                    <SelectItem key={b.value} value={b.value}>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${b.color}`}>{b.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2 space-x-reverse pt-1">
              <Button type="submit" size="sm">{'שמור'}</Button>
              <Button type="button" variant="outline" size="sm" onClick={handleCancelEdit}>{'ביטול'}</Button>
            </div>
          </form>
        </div>
      );
    }

    // Regular task display
    const hasUnreadReplies = task.replies?.some(reply => !reply.readBy?.includes(currentUser?.uid));
    const isCreator = task.createdBy === currentUser?.uid;
    const isAssignee = task.assignTo === currentUser?.uid;
    const bgColor = isCreator ? 'bg-blue-50' : isAssignee ? 'bg-green-50' : 'bg-white';
    const sortedReplies = task.replies?.sort((a, b) => b.timestamp - a.timestamp) || [];

    // Helper to render phone numbers with click-to-call
    const renderTextWithPhone = (text) => {
      if (!text) return null;
      const regex = /(#05\d{8})/g;
      const parts = [];
      let lastIndex = 0;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const phone = match[1];
        const number = phone.slice(1);
        parts.push(text.slice(lastIndex, match.index));
        parts.push(
          <span key={match.index} className="inline-flex items-center gap-1">
            {phone}
            <Button size="xs" variant="ghost" className="p-0 ml-1 text-blue-600 hover:text-blue-800" onClick={() => handleClick2Call(number)} title="התקשר">
              <span role="img" aria-label="Call">📞</span>
            </Button>
          </span>
        );
        lastIndex = match.index + phone.length;
      }
      parts.push(text.slice(lastIndex));
      return parts;
    };

    return (
      <div key={task.id} className={`w-full p-3 rounded-lg shadow-sm border ${bgColor} relative`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-grow">
            <div className="flex items-center gap-2 mb-1">
              <Checkbox
                checked={!!task.done}
                onCheckedChange={(checked) => handleTaskDone(task.id, checked)}
                className="data-[state=checked]:bg-green-600"
                aria-label={`Mark task ${task.title}`}
              />
              <span className={`font-medium ${task.done ? 'line-through text-gray-500' : ''}`}>
                {renderTextWithPhone(task.title)}
              </span>
            </div>
            {task.subtitle && (
              <p className={`text-sm text-gray-600 mb-2 ${task.done ? 'line-through' : ''}`}>
                {renderTextWithPhone(task.subtitle)}
              </p>
            )}
            <div className="text-xs text-gray-500 mt-1 space-x-2 space-x-reverse">
              <span>🗓️ {formatDateTime(task.dueDate)}</span>
              <span>👤 {assignableUsersWithSelf.find(u => u.email === task.assignTo)?.alias || task.assignTo}</span>
              {task.creatorAlias && <span className="font-medium">📝 {task.creatorAlias}</span>}
              <span>🏷️ {task.category}</span>
              <span>{task.priority === 'דחוף' ? '🔥' : task.priority === 'נמוך' ? '⬇️' : '➖'} {task.priority}</span>
            </div>
            {/* Add TaskTabs component */}
            <TaskTabs taskId={task.id} currentUser={currentUser} />
          </div>
          <div className="flex flex-col items-end gap-1 min-w-[70px]">
            {/* Branch tag */}
            {task.branch && (
              <span className={`mb-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${branchColor(task.branch)}`}>{task.branch}</span>
            )}
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setEditingTaskId(task.id);
                      setEditingTitle(task.title);
                      setEditingSubtitle(task.subtitle || '');
                      setEditingPriority(task.priority);
                      setEditingCategory(task.category);
                      if (task.dueDate) {
                        const due = new Date(task.dueDate);
                        if (!isNaN(due.getTime())) {
                          setEditingDueDate(due.toLocaleDateString('en-CA'));
                          setEditingDueTime(due.toTimeString().slice(0, 5));
                        }
                      }
                      setEditingAssignTo(task.assignTo || '');
                      setEditingBranch(task.branch || '');
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>ערוך משימה</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 relative"
                    onClick={() => {
                      setReplyingToTaskId(task.id);
                      setReplyInputValue("");
                    }}
                  >
                    <MessageCircle className="h-4 w-4" />
                    {hasUnreadReplies && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>הוסף תגובה</TooltipContent>
              </Tooltip>

              {!task.done && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`w-6 h-6 relative ${task.hasUnreadNudges ? 'text-orange-500' : 'text-gray-400'} hover:text-orange-600`}
                      title="שלח תזכורת"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNudgeTask(task.id);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <Bell className="h-4 w-4" />
                      {task.hasUnreadNudges && (
                        <span className="absolute -top-1 -right-1 h-2 w-2 bg-orange-500 rounded-full" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>שלח תזכורת</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>

        {/* Replies section */}
        {sortedReplies.length > 0 && (
          <div className="mt-2 border-t pt-2">
            <div className="text-xs font-medium text-gray-500 mb-1">תגובות:</div>
            {sortedReplies.map((reply, index) => (
              <div
                key={`${task.id}-reply-${reply.timestamp?.toMillis?.() || Date.now()}-${index}`}
                className={`text-xs mb-1 ${!reply.isRead && reply.userId !== currentUser.uid ? 'font-bold' : ''}`}
              >
                <span className="font-bold">{reply.userAlias}:</span> {reply.text}
                <span className="text-gray-400 text-xs mr-2"> ({formatDateTime(reply.timestamp)})</span>
                {!reply.isRead && reply.userId !== currentUser.uid && (
                  <span className="text-green-500 text-xs">(חדש)</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Reply input */}
        {!task.done && replyingToTaskId === task.id && (
          <div className="mt-2">
            <input
              type="text"
              placeholder="הוסף תגובה..."
              className="w-full text-sm border rounded p-1 rtl"
              autoFocus
              value={replyInputValue}
              onChange={e => setReplyInputValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === ' ' || e.code === 'Space') {
                  e.stopPropagation(); // Prevent DnD from hijacking spacebar in input
                }
                if (e.key === 'Enter' && replyInputValue.trim()) {
                  handleTaskReply(task.id, replyInputValue.trim());
                  setReplyInputValue("");
                  setReplyingToTaskId(null);
                } else if (e.key === 'Escape') {
                  setReplyingToTaskId(null);
                  setReplyInputValue("");
                }
              }}
              onBlur={() => {
                setReplyingToTaskId(null);
                setReplyInputValue("");
              }}
            />
          </div>
        )}

        {/* Mark as read button */}
        {hasUnreadReplies && (
          <div className="mt-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => handleMarkReplyAsRead(task.id)}
            >
              סמן כנקרא
            </Button>
          </div>
        )}
      </div>
    );
  };





  // Leads now come from DataContext 
  const [editingLeadId, setEditingLeadId] = useState(null);
  const [editLeadFullName, setEditLeadFullName] = useState("");
  const [editLeadPhone, setEditLeadPhone] = useState("");
  const [editLeadMessage, setEditLeadMessage] = useState("");
  const [editLeadStatus, setEditLeadStatus] = useState("חדש");
  const [editLeadSource, setEditLeadSource] = useState("");
  const [editLeadAppointmentDateTime, setEditLeadAppointmentDateTime] = useState("");
  const [editLeadBranch, setEditLeadBranch] = useState("");
  const [newConversationText, setNewConversationText] = useState("");
  const [showConvUpdate, setShowConvUpdate] = useState(null);
  const [leadSortBy, setLeadSortBy] = useState("priority");
  const [leadTimeFilter, setLeadTimeFilter] = useState("all");
  const [leadFilterFrom, setLeadFilterFrom] = useState("");
  const [leadFilterTo, setLeadFilterTo] = useState("");
  const [leadSearchTerm, setLeadSearchTerm] = useState("");
  const [leadSortDirection, setLeadSortDirection] = useState('desc');
  const allLeadCategories = useMemo(() => Object.keys(leadStatusConfig).filter(k => k !== 'Default'), []);
  const [selectedLeadCategories, setSelectedLeadCategories] = useState(() => getLayoutPref('dashboard_selectedLeadCategories', allLeadCategories));

  // Persist selectedLeadCategories to localStorage whenever it changes
  useEffect(() => {
    saveLayoutPref('dashboard_selectedLeadCategories', selectedLeadCategories);
  }, [selectedLeadCategories]);

  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsTimeFilter, setAnalyticsTimeFilter] = useState("month");
  const [analyticsFilterFrom, setAnalyticsFilterFrom] = useState("");
  const [analyticsFilterTo, setAnalyticsFilterTo] = useState("");

  // Call Log Dashboard visibility state (admin only, persisted to Firebase)
  const [showCallLogDashboard, setShowCallLogDashboard] = useState(false);
  const callLogPrefsLoaded = useRef(false);

  // Sync analytics toggle from LeadManager (bridge)
  useEffect(() => {
    function handleToggleLeadAnalytics(e) {
      try {
        if (e?.detail && typeof e.detail.open === 'boolean') {
          setShowAnalytics(e.detail.open);
        }
      } catch { }
    }
    window.addEventListener('toggle-lead-analytics', handleToggleLeadAnalytics);
    return () => window.removeEventListener('toggle-lead-analytics', handleToggleLeadAnalytics);
  }, []);

  // Load Call Log Dashboard visibility from Firebase
  useEffect(() => {
    const isAdmin = currentUserData?.role === 'admin' || role === 'admin';
    if (!currentUser || !isAdmin) return;

    const loadCallLogPrefs = async () => {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const d = snap.data();
          if (typeof d.calllog_dashboardVisible === 'boolean') {
            setShowCallLogDashboard(d.calllog_dashboardVisible);
          }
        }
        callLogPrefsLoaded.current = true;
      } catch (err) {
        console.error("Error loading call log dashboard prefs:", err);
        callLogPrefsLoaded.current = true;
      }
    };
    loadCallLogPrefs();
  }, [currentUser, role]);

  // Save Call Log Dashboard visibility to Firebase
  useEffect(() => {
    const isAdmin = currentUserData?.role === 'admin' || role === 'admin';
    if (!currentUser || !isAdmin || !callLogPrefsLoaded.current) return;

    const saveCallLogPrefs = async () => {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        await setDoc(userRef, {
          calllog_dashboardVisible: showCallLogDashboard,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (err) {
        console.error("Error saving call log dashboard prefs:", err);
      }
    };
    saveCallLogPrefs();
  }, [currentUser, role, showCallLogDashboard]);



  const [activeId, setActiveId] = useState(null);



  // Assignable users now come from DataContext
  /** listens to pull but not needed here
  const tasksRef = collection(db, "tasks");
const q = query(
  tasksRef,
  or(
    where("userId", "==", currentUser.uid),
    where("assignTo", "==", alias)
  )
);
*/

  // Leads listener now handled by DataContext


  // 🔁 Redirect if not logged in





  /**  ✅ Second: redirect if not logged in
  useEffect(() => {
    if (!loading && !currentUser) {
      router.push("/login");
    }
  }, [currentUser, loading, router]);
  */



  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, })
  );









  useEffect(() => {
    setMounted(true);
    const savedOrder = localStorage.getItem("dashboard_blockOrder");
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder);
        if (parsedOrder.TM && parsedOrder.Calendar && parsedOrder.Leads) {
          setBlockOrder(parsedOrder);
        } else {
          localStorage.removeItem("dashboard_blockOrder");
          setBlockOrder(defaultBlockOrder);
          saveLayoutPref('dashboard_blockOrder', defaultBlockOrder);
        }
      } catch (error) {
        localStorage.removeItem("dashboard_blockOrder");
        setBlockOrder(defaultBlockOrder);
        saveLayoutPref('dashboard_blockOrder', defaultBlockOrder);
      }
    } else {
      setBlockOrder(defaultBlockOrder);
      saveLayoutPref('dashboard_blockOrder', defaultBlockOrder);
    }
  }, []);


  useEffect(() => {
    const updateTime = () => {
      const now = moment();
      setCurrentDateTime(now.format('dddd, D MMMM YYYY HH:mm'));

      const hour = now.hour();
      let message = 'לילה טוב';
      let period = 'night';

      if (hour >= 5 && hour < 12) {
        message = 'בוקר טוב';
        period = 'morning';
      } else if (hour >= 12 && hour < 17) {
        message = 'צהרים טובים';
        period = 'afternoon';
      } else if (hour >= 17 && hour < 20) {
        message = 'ערב טוב';
        period = 'evening';
      }

      setGreeting({ message, period });
    };
    updateTime();
    const intervalId = setInterval(updateTime, 60000);
    return () => clearInterval(intervalId);
  }, []);





  /**
   * Cycles the display order position of a dashboard block (TM, Calendar, Leads)
   * and saves the new order to localStorage.
   * @param {'TM' | 'Calendar' | 'Leads'} key - The key of the block to reorder.
   */
  const toggleBlockOrder = useCallback((key) => {
    setBlockOrder((prevOrder) => {
      const currentPosition = prevOrder[key];
      const newPosition = currentPosition === 3 ? 1 : currentPosition + 1;
      const keyToSwap = Object.keys(prevOrder).find(k => prevOrder[k] === newPosition);
      const newOrder = { ...prevOrder, [key]: newPosition };
      if (keyToSwap && keyToSwap !== key) {
        newOrder[keyToSwap] = currentPosition;
      }
      saveLayoutPref('dashboard_blockOrder', newOrder);
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        updateDoc(userRef, { dashboard_blockOrder: newOrder, updatedAt: serverTimestamp() }).catch(() => { });
      }
      return newOrder;
    });
  }, [currentUser]);










  /**
  * Toggles a category in the selectedTaskCategories filter state.
  * @param {string} category - The category string to toggle.
  */
  const handleCategoryToggle = useCallback((category) => {
    setSelectedTaskCategories((prevSelected) => {
      const isSelected = prevSelected.includes(category);
      if (isSelected) {

        return prevSelected.filter(c => c !== category);
      } else {

        return [...prevSelected, category];
      }
    });


  }, [setSelectedTaskCategories]);


  /**
  * Parses task details (category, due date, time) from natural language input.
  * @param {string} text - The natural language input string.
  * @returns {object} - A partial task object with extracted details.
  */



  /**
  * Toggles the completion status of a task and records completion info.
  * @param {string} id - The ID of the task to toggle.
  */
  const toggleTaskDone = useCallback((id) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) => {
        if (task.id === id) {
          const isNowDone = !task.done;
          console.log(`Toggling task ${id} to done=${isNowDone}`);
          return {
            ...task,
            done: isNowDone,
            completedBy: isNowDone ? (currentUser?.alias || currentUser?.email || 'Unknown') : null,
            completedAt: isNowDone ? new Date() : null,
          };
        }
        return task;
      })
    );
  }, [setTasks, currentUser]);

  /**
  * Populates the editing form state when the user clicks the edit button on a task.
  * @param {object | null} task - The task object to edit, or null if not found.
  */
  const handleEditTask = useCallback((task) => {
    if (!task) {
      console.error("handleEditTask called with null task");
      setEditingTaskId(null);
      return;
    }
    console.log(`Editing task: ${task.id}`);
    setEditingTaskId(task.id);
    setEditingAssignTo(task.assignTo);
    setEditingTitle(task.title);
    setEditingSubtitle(task.subtitle || "");
    setEditingPriority(task.priority);
    setEditingCategory(task.category);

    try {
      if (task.dueDate) {
        const due = new Date(task.dueDate);
        if (!isNaN(due.getTime())) {
          // Format date as YYYY-MM-DD
          const dateStr = due.toLocaleDateString('en-CA'); // en-CA gives YYYY-MM-DD format
          // Format time as HH:mm
          const timeStr = due.toTimeString().slice(0, 5);

          setEditingDueDate(dateStr);
          setEditingDueTime(timeStr);
          return;
        }
      }
      // If we get here, either no date or invalid date - use current date/time
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-CA');
      const timeStr = now.toTimeString().slice(0, 5);

      setEditingDueDate(dateStr);
      setEditingDueTime(timeStr);
    } catch (error) {
      console.error("Error processing task due date for editing:", task.dueDate, error);
      // On error, still use current date/time
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-CA');
      const timeStr = now.toTimeString().slice(0, 5);

      setEditingDueDate(dateStr);
      setEditingDueTime(timeStr);
    }
  }, [setEditingTaskId, setEditingAssignTo, setEditingTitle, setEditingSubtitle, setEditingPriority, setEditingCategory, setEditingDueDate, setEditingDueTime]);

  /**
  * Saves the edited task details back to the main tasks state.
  * Combines date and time inputs into a Date object.
  * @param {React.FormEvent} e - The form submission event.
  */
  const handleSaveTask = useCallback(async (e) => {
    e.preventDefault();
    if (!editingTaskId) return;

    let dueDateTime = null;
    try {
      if (editingDueDate && editingDueDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const timeString = editingDueTime || "00:00";
        const dateTimeStr = `${editingDueDate}T${timeString}:00`;
        const newDate = new Date(dateTimeStr);

        if (!isNaN(newDate.getTime())) {
          dueDateTime = newDate;
        } else {
          console.error("Invalid date/time combination:", dateTimeStr);
        }
      }
    } catch (error) {
      console.error("Error creating due date from inputs:", editingDueDate, editingDueTime, error);
    }

    // Update Firestore
    try {
      const taskRef = doc(db, "tasks", editingTaskId);
      await updateDoc(taskRef, {
        assignTo: editingAssignTo,
        title: editingTitle,
        subtitle: editingSubtitle,
        priority: editingPriority,
        category: editingCategory,
        dueDate: dueDateTime ? dueDateTime.toISOString() : null,
        done: false, // Always reset to not done on edit, or use the previous value if you want to preserve
        completedBy: null,
        completedAt: null,
        updatedAt: serverTimestamp(),
        // Add any other fields you want to always persist
      });
    } catch (error) {
      console.error("Error updating task in Firestore:", error);
      alert("שגיאה בעדכון המשימה בשרת");
    }

    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === editingTaskId
          ? {
            ...task,
            creatorId: currentUser?.uid || task.creatorId,
            assignTo: editingAssignTo,
            title: editingTitle,
            subtitle: editingSubtitle,
            priority: editingPriority,
            category: editingCategory,
            dueDate: dueDateTime ? dueDateTime.toISOString() : null,
            done: false,
            completedBy: null,
            completedAt: null,
            branch: editingBranch,
          }
          : task
      )
    );

    setEditingTaskId(null);
    setEditingAssignTo("");
    setEditingTitle("");
    setEditingSubtitle("");
    setEditingPriority("רגיל");
    setEditingCategory(taskCategories[0] || "");
    setEditingDueDate("");
    setEditingDueTime("");
    setEditingBranch('');
  }, [editingTaskId, editingAssignTo, editingTitle, editingSubtitle, editingPriority, editingCategory, editingDueDate, editingDueTime, setTasks, setEditingTaskId, setEditingAssignTo, setEditingTitle, setEditingSubtitle, setEditingPriority, setEditingCategory, setEditingDueDate, setEditingDueTime, currentUser, editingBranch]);

  /**
  * Cancels the task editing process and clears the editing form state.
  */
  const handleCancelEdit = useCallback(() => {
    setEditingTaskId(null);

    setEditingAssignTo("");
    setEditingTitle("");
    setEditingSubtitle("");
    setEditingPriority("רגיל");
    setEditingCategory(taskCategories[0] || "");
    setEditingDueDate("");
    setEditingDueTime("");
  }, [setEditingTaskId, setEditingAssignTo, setEditingTitle, setEditingSubtitle, setEditingPriority, setEditingCategory, setEditingDueDate, setEditingDueTime]);

  /** --- NEW: Handler for Complete & Reply --- */
  const handleCompleteAndReply = useCallback(async (taskId) => {
    console.log(`Complete & Reply action initiated for task: ${taskId}`);
    if (!currentUser) {
      console.error("Cannot reply: No current user");
      alert("שגיאה: משתמש לא מחובר");
      return;
    }

    try {
      const taskRef = doc(db, 'tasks', taskId);
      const taskDoc = await getDoc(taskRef);

      if (!taskDoc.exists()) {
        console.error("Task not found");
        alert("שגיאה: המשימה לא נמצאה");
        return;
      }

      const task = taskDoc.data();
      const replyMessage = prompt(`הזן תגובה עבור המשימה "${task.title}":`);

      if (replyMessage === null || !replyMessage.trim()) {
        console.log("Reply cancelled or empty");
        return;
      }

      // Create the new reply with regular Date object
      const now = new Date();
      const newReply = {
        id: `reply-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: replyMessage,
        timestamp: now.toISOString(), // Use ISO string instead of serverTimestamp
        userId: currentUser.uid,
        userAlias: alias || currentUser.email,
        isRead: false
      };

      // Get existing replies
      const existingReplies = task.replies || [];

      // Update the task in Firebase
      await updateDoc(taskRef, {
        done: true,
        completedAt: serverTimestamp(), // These can still use serverTimestamp
        completedBy: currentUser?.alias || currentUser?.email || 'Unknown',
        replies: [...existingReplies, newReply],
        hasNewReply: true,
        lastReplyAt: serverTimestamp(), // This too
        updatedAt: serverTimestamp() // And this
      });

      console.log('Task completed and reply added successfully');
    } catch (error) {
      console.error('Error in Complete & Reply:', error);
      alert('שגיאה בשמירת התגובה והשלמת המשימה');
    }
  }, [currentUser, alias]);


  /**
  * Handles submission of the "Return Task" modal. (Placeholder)
  * @param {React.FormEvent} e - The form submission event.
  */
  const handleReturnSubmit = useCallback((e) => {
    e.preventDefault();
    if (!returnTaskId) return;
    console.log("Returning task:", returnTaskId, "to:", returnNewAssignee, "Comment:", returnComment);

    alert("פונקציונליות החזרת משימה עדיין בפיתוח.");

    setShowReturnModal(false);
    setReturnComment("");
    setReturnNewAssignee("");
    setReturnTaskId(null);
  }, [returnTaskId, returnNewAssignee, returnComment, setShowReturnModal, setReturnComment, setReturnNewAssignee, setReturnTaskId]);

  // Add state for archived tasks
  const [archivedTasks, setArchivedTasks] = useState([]);

  // Fetch archived tasks for history modal
  useEffect(() => {
    if (!currentUser) return;
    const archivedRef = collection(db, "archivedTasks");
    const unsubscribe = onSnapshot(archivedRef, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data());
      setArchivedTasks(data);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Update handleClearDoneTasks to archive before delete
  const handleClearDoneTasks = useCallback(async () => {
    if (!currentUser) {
      console.error("No user found");
      return;
    }
    if (window.confirm("האם אתה בטוח שברצונך למחוק את כל המשימות שבוצעו? לא ניתן לשחזר פעולה זו.")) {
      try {
        // Get all completed tasks that belong to the current user
        const completedTasks = tasks.filter(task =>
          task.done && (
            task.userId === currentUser.uid ||
            task.creatorId === currentUser.uid ||
            task.assignTo === currentUser.email ||
            task.assignTo === currentUser.alias
          )
        );
        if (completedTasks.length === 0) {
          console.log("No completed tasks to delete");
          return;
        }
        // Archive and delete each completed task
        const archiveAndDeletePromises = completedTasks.map(async task => {
          try {
            // Use the best available alias for archiving
            const aliasToArchive = task.completedByAlias || task.completedBy || task.creatorAlias || task.creatorEmail || task.assignTo || alias || currentUser?.alias || currentUser?.email || '';
            await setDoc(doc(db, 'archivedTasks', task.id), {
              ...task,
              completedByAlias: aliasToArchive,
              archivedAt: new Date(),
            });
            await deleteDoc(doc(db, 'tasks', task.id));
            return task.id;
          } catch (error) {
            console.error(`Failed to archive/delete task ${task.id}:`, error);
            return null;
          }
        });
        const results = await Promise.allSettled(archiveAndDeletePromises);
        const successfulDeletes = results
          .filter(result => result.status === 'fulfilled' && result.value)
          .map(result => result.value);
        setTasks(prevTasks => prevTasks.filter(task => !successfulDeletes.includes(task.id)));
        console.log(`Successfully archived and deleted ${successfulDeletes.length} of ${completedTasks.length} completed tasks`);
        if (successfulDeletes.length < completedTasks.length) {
          alert('חלק מהמשימות לא נמחקו עקב הרשאות חסרות');
        }
      } catch (error) {
        console.error('Error archiving/deleting completed tasks:', error);
        alert('שגיאה במחיקת המשימות שבוצעו');
      }
    }
  }, [tasks, currentUser, alias]);

  // Restore task from archive (admin only)
  const restoreTask = async (archivedTask) => {
    if (!currentUser || !currentUser.isAdmin) {
      alert('רק אדמין יכול לשחזר משימות');
      return;
    }
    try {
      // Restore to tasks collection
      await setDoc(doc(db, 'tasks', archivedTask.id), {
        ...archivedTask,
        done: false,
        completedAt: null,
        completedBy: null,
        archivedAt: null,
        updatedAt: serverTimestamp(),
      });
      // Remove from archive
      await deleteDoc(doc(db, 'archivedTasks', archivedTask.id));
      alert('המשימה שוחזרה בהצלחה');
    } catch (error) {
      console.error('Error restoring task:', error);
      alert('שגיאה בשחזור המשימה');
    }
  };

  /** Checks if a lead's creation date falls within the selected time filter range. */
  const isLeadInTimeRange = useCallback((lead) => {
    try {
      const created = new Date(lead.createdAt);
      if (isNaN(created.getTime())) return false;

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
          fromDate.setHours(0, 0, 0, 0);
          if (isNaN(fromDate.getTime())) { /* handle invalid date */ }
          else if (created < fromDate) inRange = false;
        }
        if (leadFilterTo) {
          const toDate = new Date(leadFilterTo);
          toDate.setHours(23, 59, 59, 999);
          if (isNaN(toDate.getTime())) { /* handle invalid date */ }
          else if (created > toDate) inRange = false;
        }
        return inRange;
      } else {

        return true;
      }
    } catch (error) {
      console.error("Error checking lead time range:", lead, error);
      return false;
    }
  }, [leadTimeFilter, leadFilterFrom, leadFilterTo]);

  /** Comparison function for sorting leads based on selected criteria */
  const compareLeads = useCallback((a, b) => {
    if (leadSortBy === "priority") {
      const priorityDiff = leadPriorityValue(a.status) - leadPriorityValue(b.status);
      if (priorityDiff !== 0) return priorityDiff;
      try {
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
        return leadSortDirection === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
      } catch (e) { return 0; }
    } else {
      try {
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
        return leadSortDirection === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
      } catch (e) { return 0; }
    }
  }, [leadSortBy, leadSortDirection]);

  /** Populates the editing form state for a lead. */
  const handleEditLead = useCallback((lead) => {
    setEditingLeadId(lead.id);
    setEditLeadFullName(lead.fullName);
    setEditLeadPhone(lead.phoneNumber);
    setEditLeadMessage(lead.message);
    setEditLeadStatus(lead.status || "חדש");
    setEditLeadSource(lead.source || "");
    setEditLeadAppointmentDateTime(lead.appointmentDateTime || "");
    setNewConversationText("");
    setEditLeadBranch(lead.branch || "");
  }, []);

  // --- Handle lead expand/collapse ---
  useEffect(() => {
    function handleOpenLead(e) {
      if (e.detail && e.detail.leadId) {
        const lead = leads.find(l => l.id === e.detail.leadId);
        if (lead) {
          handleEditLead(lead); // Populate form fields
          setExpandedLeadId(e.detail.leadId);
        }
      }
    }
    window.addEventListener('open-lead', handleOpenLead);
    return () => window.removeEventListener('open-lead', handleOpenLead);
  }, [leads, handleEditLead]);


  /** Saves the edited lead details back to the main leads state. Creates task if needed. */
  const handleSaveLead = useCallback(async (e, leadId) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      let appointmentDate = null;
      if (editLeadStatus === 'תור נקבע' && editLeadAppointmentDateTime) {
        appointmentDate = new Date(editLeadAppointmentDateTime);
        if (isNaN(appointmentDate.getTime())) {
          alert("תאריך פגישה לא תקין.");
          return;
        }
      }

      const leadRef = doc(db, 'leads', leadId);
      const leadDoc = await getDoc(leadRef);
      if (!leadDoc.exists()) {
        throw new Error('Lead not found');
      }

      const originalLead = leadDoc.data();
      const updateData = {
        fullName: editLeadFullName,
        phoneNumber: editLeadPhone,
        message: editLeadMessage,
        status: editLeadStatus,
        source: editLeadSource,
        branch: editLeadBranch,
        appointmentDateTime: editLeadStatus === 'תור נקבע' ? (appointmentDate || null) : null,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid
      };
      // Reset followUpCall if status changed
      if (originalLead.status !== editLeadStatus) {
        updateData.followUpCall = { active: false, count: 0 };
      }

      await updateDoc(leadRef, updateData);

      // Log activity for lead update
      if (currentUser) {
        await logActivity(
          currentUser.uid,
          alias || currentUser.email,
          "update",
          "lead",
          leadId,
          {
            fullName: editLeadFullName,
            status: editLeadStatus,
            statusChanged: originalLead.status !== editLeadStatus
          }
        );
      }

      // Create appointment task if status changed to 'תור נקבע'
      if (originalLead.status !== 'תור נקבע' && editLeadStatus === 'תור נקבע' && appointmentDate) {
        const taskRef = doc(collection(db, "tasks"));
        const newTask = {
          id: taskRef.id,
          userId: currentUser.uid,
          creatorId: currentUser.uid,
          creatorAlias: alias || currentUser.email || "",
          assignTo: currentUser.email,
          title: `פגישת ייעוץ - ${editLeadFullName}`,
          subtitle: `נקבעה פגישה מליד ${leadId}`,
          priority: "רגיל",
          category: "לקבוע סדרה",
          status: "פתוח",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          dueDate: appointmentDate,
          replies: [],
          isRead: false,
          isArchived: false,
          done: false,
          completedBy: null,
          completedAt: null,
          branch: editLeadBranch,
        };

        await setDoc(taskRef, newTask);
      }

      setEditingLeadId(null);
      setEditLeadAppointmentDateTime("");
    } catch (error) {
      console.error("Error saving lead:", error);
      alert("שגיאה בשמירת הליד");
    }
  }, [
    currentUser,
    alias,
    editLeadFullName,
    editLeadPhone,
    editLeadMessage,
    editLeadStatus,
    editLeadSource,
    editLeadAppointmentDateTime,
    editLeadBranch
  ]);

  /** Collapses a lead's detailed/editing view. */
  const handleCollapseLead = useCallback((leadId) => {
    setExpandedLeadId(null);

    if (editingLeadId === leadId) {
      setEditingLeadId(null);
      setEditLeadAppointmentDateTime("");
    }
  }, [editingLeadId, setExpandedLeadId, setEditingLeadId, setEditLeadAppointmentDateTime]);

  /** Adds a new entry to a lead's conversation summary and saves to Firestore */
  const handleAddConversation = useCallback(async (leadId) => {
    if (!newConversationText.trim() || !currentUser) return;

    try {
      const leadRef = doc(db, 'leads', leadId);
      const newEntry = {
        text: newConversationText,
        timestamp: new Date(), // Use client time instead of serverTimestamp()
        userId: currentUser.uid,
        userAlias: alias || currentUser.email
      };

      // Update Firestore - add new entry to the start of the array
      await updateDoc(leadRef, {
        conversationSummary: arrayUnion(newEntry),
        updatedAt: serverTimestamp()
      });

      setNewConversationText("");
      setShowConvUpdate(leadId);
    } catch (error) {
      console.error("Error adding conversation entry:", error);
      alert("שגיאה בהוספת עדכון שיחה");
    }
  }, [newConversationText, currentUser, alias]);

  /** Handles submission of the Add New Lead modal form. */
  const handleAddNewLead = useCallback(async (e) => {
    e.preventDefault();

    if (!newLeadFullName.trim() || !newLeadPhone.trim()) {
      alert("אנא מלא שם מלא ומספר טלפון.");
      return;
    }

    try {
      const leadRef = await addDoc(collection(db, "leads"), {
        createdAt: serverTimestamp(),
        fullName: newLeadFullName.trim(),
        phoneNumber: newLeadPhone.trim(),
        message: newLeadMessage.trim(),
        status: newLeadStatus,
        source: newLeadSource.trim(),
        conversationSummary: [],
        isHot: newLeadIsHot,
        followUpCall: { active: false, count: 0 },
      });

      // Log activity for lead creation
      if (currentUser) {
        await logActivity(
          currentUser.uid,
          alias || currentUser.email,
          "create",
          "lead",
          leadRef.id,
          { fullName: newLeadFullName.trim(), status: newLeadStatus }
        );
      }

      setNewLeadFullName("");
      setNewLeadPhone("");
      setNewLeadMessage("");
      setNewLeadStatus("חדש");
      setNewLeadSource("");
      setNewLeadIsHot(true);
      setShowAddLeadModal(false);
    } catch (error) {
      console.error("שגיאה בהוספת ליד חדש:", error);
      alert("שגיאה בהוספת ליד חדש. נסה שוב.");
    }
  }, [
    newLeadFullName, newLeadPhone, newLeadMessage,
    newLeadStatus, newLeadSource, newLeadIsHot,
    setNewLeadFullName, setNewLeadPhone, setNewLeadMessage, setNewLeadStatus, setNewLeadSource, setNewLeadIsHot, setShowAddLeadModal
  ]);





  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id);
  }, [setActiveId]);

  const handleDragEnd = useCallback(async (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || !active) return;

    // Get the task ID and data
    const taskId = active.id.replace('task-', '');
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Find the target category by traversing up the DOM
    let targetElement = over.data.current?.droppableContainer?.node;
    let targetCategory = null;

    // Keep looking up the DOM tree until we find the category container
    while (targetElement && !targetCategory) {
      targetCategory = targetElement.dataset?.category;
      if (!targetCategory) {
        targetElement = targetElement.parentElement;
      }
    }

    console.log("Drag end:", {
      taskId,
      currentCategory: task.category,
      targetCategory,
      overData: over.data.current,
      targetElement
    });

    // If we found a valid category and it's different from the current one
    if (targetCategory && targetCategory !== task.category) {
      try {
        console.log(`Updating task ${taskId} category from ${task.category} to ${targetCategory}`);

        // Update Firestore first
        const taskRef = doc(db, 'tasks', taskId);
        await updateDoc(taskRef, {
          category: targetCategory,
          updatedAt: serverTimestamp()
        });

        // Then update local state
        setTasks(prevTasks =>
          prevTasks.map(t =>
            t.id === taskId
              ? {
                ...t,
                category: targetCategory,
                updatedAt: new Date() // Local timestamp for immediate UI update
              }
              : t
          )
        );

        console.log("Task category updated successfully");
      } catch (error) {
        console.error("Error updating task category:", error);
        alert("שגיאה בעדכון קטגוריית המשימה");
      }
    } else {
      console.log("No category change needed:", {
        currentCategory: task.category,
        targetCategory
      });
    }
  }, [tasks]);









  const sortedAndFilteredTasks = useMemo(() => {
    const lowerSearchTerm = taskSearchTerm.toLowerCase();

    let filtered = tasks.filter((task) => {
      // Admin can see all tasks
      if (currentUser?.isAdmin) return true;

      // Regular users can see tasks assigned to them or created by them
      const isAssignedToMe = task.assignTo === currentUser?.email ||
        task.assignTo === currentUser?.alias ||
        task.assignTo === "עצמי" && task.creatorId === currentUser?.uid;
      const isCreatedByMe = task.creatorId === currentUser?.uid;

      if (!isAssignedToMe && !isCreatedByMe) return false;

      const assigneeMatch = taskFilter === "הכל" ||
        (taskFilter === "שלי" && (task.assignTo === currentUser?.email || task.assignTo === currentUser?.alias)) ||
        (taskFilter === "אחרים" && task.assignTo !== currentUser?.email && task.assignTo !== currentUser?.alias);

      const doneMatch = showDoneTasks || !task.done;

      const priorityMatch = taskPriorityFilter === 'all' || task.priority === taskPriorityFilter;

      const categoryMatch = selectedTaskCategories.length === 0 || selectedTaskCategories.includes(task.category);

      const searchTermMatch = !lowerSearchTerm ||
        task.title.toLowerCase().includes(lowerSearchTerm) ||
        (task.subtitle && task.subtitle.toLowerCase().includes(lowerSearchTerm));

      return assigneeMatch && doneMatch && priorityMatch && categoryMatch && searchTermMatch;
    });




    if (!userHasSortedTasks || isTMFullView) {
      filtered = filtered.sort((a, b) => {


        const aIsDone = typeof a.done === 'boolean' ? a.done : false;
        const bIsDone = typeof b.done === 'boolean' ? b.done : false;
        if (aIsDone !== bIsDone) return aIsDone ? 1 : -1;


        try {

          const dateA = a.dueDate instanceof Date && !isNaN(a.dueDate) ? a.dueDate.getTime() : Infinity;
          const dateB = b.dueDate instanceof Date && !isNaN(b.dueDate) ? b.dueDate.getTime() : Infinity;

          if (dateA === Infinity && dateB === Infinity) return 0;
          if (dateA === Infinity) return 1;
          if (dateB === Infinity) return -1;
          return dateA - dateB;
        } catch (e) {
          console.error("Error during task date sort:", e);
          return 0;
        }
      });
    }



    return filtered;
  }, [
    tasks, taskFilter, showDoneTasks, userHasSortedTasks, isTMFullView,
    taskPriorityFilter, selectedTaskCategories, taskSearchTerm, currentUser
  ]);


  const events = useMemo(() => {
    return [
      ...(taskCalendarData?.events || []),
      ...(leadCalendarData?.events || [])
    ];
  }, [taskCalendarData, leadCalendarData]);


  const leadsSorted = useMemo(() => {
    const lowerSearchTerm = leadSearchTerm.toLowerCase();
    // Filter by time, search, and selected categories
    let filtered = leads
      .filter(isLeadInTimeRange)
      .filter(lead => selectedLeadCategories.includes(lead.status))
      .filter(lead => {
        if (!lowerSearchTerm) return true;
        return (
          lead.fullName?.toLowerCase().includes(lowerSearchTerm) ||
          lead.phoneNumber?.includes(lowerSearchTerm) ||
          lead.message?.toLowerCase().includes(lowerSearchTerm) ||
          lead.source?.toLowerCase().includes(lowerSearchTerm) ||
          lead.status?.toLowerCase().includes(lowerSearchTerm)
        );
      });
    // Group by status/category, sort within each group, then flatten
    const grouped = {};
    filtered.forEach(lead => {
      if (!grouped[lead.status]) grouped[lead.status] = [];
      grouped[lead.status].push(lead);
    });
    let result = [];
    allLeadCategories.forEach(cat => {
      if (grouped[cat]) {
        result = result.concat(grouped[cat].sort(compareLeads));
      }
    });
    return result;
  }, [leads, leadSearchTerm, isLeadInTimeRange, compareLeads, selectedLeadCategories, allLeadCategories]);


  const calculatedAnalytics = useMemo(() => {
    const now = moment();
    let startDate, endDate = now.clone().endOf('day');


    switch (analyticsTimeFilter) {
      case 'week': startDate = now.clone().subtract(6, 'days').startOf('day'); break;
      case 'month': startDate = now.clone().startOf('month').startOf('day'); break;
      case 'last_month':
        startDate = now.clone().subtract(1, 'month').startOf('month').startOf('day');
        endDate = now.clone().subtract(1, 'month').endOf('month').endOf('day');
        break;
      case 'custom':
        try {
          startDate = analyticsFilterFrom ? moment(analyticsFilterFrom).startOf('day') : null;
          endDate = analyticsFilterTo ? moment(analyticsFilterTo).endOf('day') : now.clone().endOf('day');

          if (startDate && !startDate.isValid()) startDate = null;
          if (endDate && !endDate.isValid()) endDate = now.clone().endOf('day');
          if (startDate && endDate && startDate.isAfter(endDate)) [startDate, endDate] = [endDate, startDate];
        } catch (e) { console.error("Error parsing custom dates for analytics", e); return null; }
        break;
      default:
        startDate = now.clone().startOf('month').startOf('day');
    }


    const filteredLeads = leads.filter(lead => {
      try {

        const createdAt = lead.createdAt instanceof Date && !isNaN(lead.createdAt) ? lead.createdAt : null;
        if (!createdAt) return false;

        const leadMoment = moment(createdAt);
        const startCheck = startDate ? leadMoment.isSameOrAfter(startDate) : true;
        const endCheck = endDate ? leadMoment.isSameOrBefore(endDate) : true;
        return startCheck && endCheck;
      } catch (e) { return false; }
    });

    const totalLeads = filteredLeads.length;

    const baseAnalytics = {
      totalLeads: 0, statusCounts: {}, sourceCounts: {}, leadsPerDay: 0, conversionRate: 0, avgAnswerTimeHours: 'N/A', graphData: [], range: { start: startDate?.format('DD/MM/YY'), end: endDate?.format('DD/MM/YY') }
    };

    if (totalLeads === 0) {
      return baseAnalytics;
    }


    const statusCounts = filteredLeads.reduce((acc, lead) => { acc[lead.status] = (acc[lead.status] || 0) + 1; return acc; }, {});
    const sourceCounts = filteredLeads.reduce((acc, lead) => { const source = lead.source || "לא ידוע"; acc[source] = (acc[source] || 0) + 1; return acc; }, {});
    const daysInRange = startDate ? Math.max(1, endDate.diff(startDate, 'days') + 1) : 1;
    const leadsPerDay = totalLeads / daysInRange;

    // Calculate conversion rates
    // 1. First conversion: נקבע יעוץ / (total leads - באג)
    const realLeads = filteredLeads.filter(l => l.status !== 'באג');
    const consultationLeads = filteredLeads.filter(l => l.status === 'נקבע יעוץ').length;
    const firstConversionRate = realLeads.length > 0 ? (consultationLeads / realLeads.length) * 100 : 0;

    // 2. Second conversion: נקבעה סדרה / נקבע יעוץ
    const scheduledLeads = filteredLeads.filter(l => l.status === 'נקבעה סדרה').length;
    const secondConversionRate = consultationLeads > 0 ? (scheduledLeads / consultationLeads) * 100 : 0;

    // Legacy conversion rate (for backward compatibility)
    const convertedCount = filteredLeads.filter(l => l.status === 'תור נקבע' || l.status === 'בסדרת טיפול').length;
    const conversionRate = (convertedCount / totalLeads) * 100;


    let totalAnswerTimeMs = 0, leadsWithAnswer = 0, avgAnswerTimeString = 'N/A';
    filteredLeads.forEach(lead => {

      if (Array.isArray(lead.conversationSummary) && lead.conversationSummary.length > 0 && lead.createdAt instanceof Date && !isNaN(lead.createdAt)) {
        try {



          const firstInteractionEntry = lead.conversationSummary[lead.conversationSummary.length - 1];

          const firstInteractionTime = firstInteractionEntry.timestamp instanceof Date && !isNaN(firstInteractionEntry.timestamp) ? firstInteractionEntry.timestamp : null;

          if (firstInteractionTime) {
            const diffMs = firstInteractionTime.getTime() - lead.createdAt.getTime();
            if (diffMs >= 0) {
              totalAnswerTimeMs += diffMs;
              leadsWithAnswer++;
            }
          }
        } catch (e) { console.error("Error calculating answer time for lead:", lead.id, e); }
      }
    });
    const avgAnswerTimeMs = leadsWithAnswer > 0 ? totalAnswerTimeMs / leadsWithAnswer : null;
    if (avgAnswerTimeMs !== null) {
      const hours = avgAnswerTimeMs / (1000 * 60 * 60);
      avgAnswerTimeString = hours < 48 ? `${hours.toFixed(1)} שעות` : `${(hours / 24).toFixed(1)} ימים`;
    }


    const graphDataMap = new Map();
    if (startDate && endDate) {
      let currentDate = startDate.clone();
      while (currentDate.isSameOrBefore(endDate, 'day')) {
        graphDataMap.set(currentDate.format('YYYY-MM-DD'), 0);
        currentDate.add(1, 'day');
      }
    }
    filteredLeads.forEach(lead => {
      try {
        const createdAt = lead.createdAt instanceof Date && !isNaN(lead.createdAt) ? lead.createdAt : null;
        if (createdAt) {
          const day = moment(createdAt).format('YYYY-MM-DD');
          if (graphDataMap.has(day)) {
            graphDataMap.set(day, (graphDataMap.get(day) || 0) + 1);
          }
        }
      } catch (e) { /* ignore errors during graph data mapping */ }
    });
    const graphData = Array.from(graphDataMap.entries())
      .map(([name, received]) => ({ name: moment(name).format('MMM D'), received }))
      .sort((a, b) => moment(a.name, 'MMM D').valueOf() - moment(b.name, 'MMM D').valueOf());


    return {
      totalLeads, statusCounts, sourceCounts,
      leadsPerDay: leadsPerDay.toFixed(1),
      conversionRate: conversionRate.toFixed(1),
      firstConversionRate: firstConversionRate.toFixed(1),
      secondConversionRate: secondConversionRate.toFixed(1),
      avgAnswerTimeHours: avgAnswerTimeString,
      graphData,
      range: { start: startDate?.format('DD/MM/YY'), end: endDate?.format('DD/MM/YY') }
    };

  }, [leads, analyticsTimeFilter, analyticsFilterFrom, analyticsFilterTo]);












  if (!mounted) {
    return (<div className="flex items-center justify-center min-h-screen">טוען...</div>);
  }








  const activeTaskForOverlay = activeId && typeof activeId === 'string' && activeId.startsWith('task-')
    ? tasks.find(task => `task-${task.id}` === activeId)
    : null;
  if (!mounted || loading) {
    return <div className="flex items-center justify-center min-h-screen">בודק הרשאות...</div>;
  }

  const GreetingIcon = greetingIconMap[greeting.period];
  const greetingColor = greetingColorMap[greeting.period] || 'text-slate-500';
  const greetingTarget = alias || (currentUser?.email || '');
  const greetingLine = greetingTarget ? `${greeting.message}, ${greetingTarget}` : greeting.message;

  return (
    <TooltipProvider>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>

        <header dir="rtl" className="border-b bg-white shadow-sm sticky top-0 z-20">
          {/* Mobile Header - Single Row */}
          <div className="flex sm:hidden items-start justify-between px-2 py-1.5 relative">
            {/* Top Left - Version & Logout */}
            <div className="flex flex-col items-start text-[10px] text-gray-500">
              <span className="leading-tight">v7.8</span>
              <button
                className="text-[10px] text-red-600 underline leading-tight"
                onClick={() => {
                  import("firebase/auth").then(({ signOut }) =>
                    signOut(auth).then(() => router.push("/login"))
                  );
                }}
              >
                התנתק
              </button>
              {(currentUserData?.role === 'admin' || role === 'admin') && (
                <button
                  className="text-[10px] text-blue-600 underline leading-tight mt-0.5"
                  onClick={() => router.push('/call-logs')}
                >
                  📞 לוח שיחות
                </button>
              )}
            </div>

            {/* Top Center - Logo */}
            <div className="flex items-center justify-center absolute left-1/2 -translate-x-1/2">
              <Image
                src="/logo.png"
                alt="Logo"
                width={90}
                height={36}
                className="h-8"
              />
            </div>

            {/* Top Right - DateTime & Greeting */}
            <div className="flex flex-col items-end text-[10px] text-gray-600">
              <div className="leading-tight">{currentDateTime || 'טוען...'}</div>
              <div className="flex items-center gap-0.5 leading-tight text-gray-700">
                {GreetingIcon ? <GreetingIcon className={`h-3 w-3 ${greetingColor}`} aria-hidden="true" /> : null}
                <span className="truncate max-w-[100px]">{greeting.message}</span>
              </div>
            </div>
          </div>

          {/* Desktop Header - Original Layout */}
          <div className="hidden sm:flex flex-row items-center justify-between p-4 min-h-[90px]">
            <div className="w-48 text-right text-sm text-gray-600 flex flex-col items-start">
              <div className="w-full text-right">{currentDateTime || 'טוען תאריך...'}</div>
              <div className="text-xs text-gray-700 w-full text-right flex items-center justify-end gap-1">
                {GreetingIcon ? <GreetingIcon className={`h-4 w-4 ${greetingColor}`} aria-hidden="true" /> : null}
                <span>{greetingLine}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => setIsCalendarVisible(v => !v)}
              >
                {isCalendarVisible ? 'הסתר יומן' : 'הצג יומן'}
              </Button>
            </div>

            <div className="flex-1 flex items-center justify-center relative px-4">
              <div className="absolute right-2 flex gap-2">
                <NotesAndLinks section="links" />
              </div>

              <Image
                src="/logo.png"
                alt="Logo"
                width={140}
                height={56}
                className="h-14 inline-block"
              />

              <div className="absolute left-0 flex gap-2">
                <NotesAndLinks section="notes" />
              </div>
            </div>

            <div className="w-48 text-left text-sm text-gray-500 flex flex-col items-end">
              <span>{'Version 7.8'}</span>
              <button
                className="text-xs text-red-600 underline"
                onClick={() => {
                  import("firebase/auth").then(({ signOut }) =>
                    signOut(auth).then(() => router.push("/login"))
                  );
                }}
              >
                התנתק
              </button>
              <UserManagement role={role} currentUserData={currentUserData} />
              {(currentUserData?.role === 'admin' || role === 'admin') && (
                <Button
                  size="sm"
                  variant={showCallLogDashboard ? "default" : "outline"}
                  onClick={() => setShowCallLogDashboard(v => !v)}
                  className="mt-1"
                >
                  {showCallLogDashboard ? 'הסתר לוח שיחות' : 'לוח שיחות'}
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* Fixed Tasks Component - Full Width */}
        <FixedTasks
          currentUser={currentUser}
          users={users}
          isVisible={fixedTasksVisible}
          onToggleVisibility={toggleFixedTasksVisibility}
        />

        <div dir="rtl" className="grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-4 p-2 sm:p-4 bg-gray-50 min-h-[calc(100vh-90px)] overflow-x-hidden max-w-full">
          <CandidatesBlock
            isFullView={isLeadsFullView}
            setIsFullView={setIsLeadsFullView}
            createAutomatedTask={createAutomatedTreatmentTask} // <-- Add this line
          />
          <div style={{ order: blockOrder.TM }} className={`col-span-1 ${isTMFullView ? 'lg:col-span-12' : 'lg:col-span-4'} transition-all duration-300 ease-in-out`}>
            <TaskManager
              isTMFullView={isTMFullView}
              setIsTMFullView={setIsTMFullView}
              blockPosition={blockOrder.TM}
              onToggleBlockOrder={() => toggleBlockOrder("TM")}
              onCalendarDataChange={setTaskCalendarData}
              handleClick2Call={handleClick2Call}
              fixedTasksVisible={fixedTasksVisible}
              onToggleFixedTasks={toggleFixedTasksVisibility}
            />
          </div>




          {isCalendarVisible && (
            <div style={{ order: blockOrder.Calendar }} className={`col-span-1 ${isCalendarFullView ? 'lg:col-span-12' : 'lg:col-span-4'} transition-all duration-300 ease-in-out`}>
              <Card className="h-full flex flex-col">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>{'לוח שנה'}</CardTitle>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setIsCalendarFullView(v => !v)} variant="outline">
                        {isCalendarFullView ? 'תצוגה מקוצרת' : 'תצוגה מלאה'}
                      </Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="xs" onClick={() => toggleBlockOrder("Calendar")}> {'מיקום: '}{blockOrder.Calendar} </Button>
                        </TooltipTrigger>
                        <TooltipContent>{'שנה מיקום בלוק'}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                </CardHeader>
                <CardContent className="flex flex-col flex-grow h-full">
                  <div className="flex-1 min-h-[400px] h-full">
                    <FullCalendarDemo
                      selectedDate={selectedDate}
                      setSelectedDate={setSelectedDate}
                      scrollToTime={new Date()}
                      eventPropGetter={() => ({
                        style: { textAlign: "right" }
                      })}
                      id="calendar-dropzone"
                      localizer={localizer}
                      events={events}
                      view={view}
                      date={selectedDate}
                      onNavigate={setSelectedDate}
                      onView={(newView) => {
                        setView(newView);
                        localStorage.setItem("calendarView", newView);
                      }}
                      onSelectEvent={event => {
                        if (event.id.startsWith('task-')) {
                          const id = event.id.replace('task-', '');
                          window.dispatchEvent(new CustomEvent('open-task', { detail: { taskId: id } }));
                        } else if (event.id.startsWith('lead-')) {
                          const id = event.id.replace('lead-', '');
                          window.dispatchEvent(new CustomEvent('open-lead', { detail: { leadId: id } }));
                        }
                      }}
                      formats={{
                        timeGutterFormat: 'HH:mm',
                        eventTimeRangeFormat: ({ start, end }, culture, local) => local.format(start, 'HH:mm', culture) + ' - ' + local.format(end, 'HH:mm', culture),
                        agendaTimeRangeFormat: ({ start, end }, culture, local) => local.format(start, 'HH:mm', culture) + ' - ' + local.format(end, 'HH:mm', culture),
                        selectRangeFormat: ({ start, end }, culture, local) => local.format(start, 'HH:mm', culture) + ' - ' + local.format(end, 'HH:mm', culture)
                      }}
                      messages={messages}
                      style={{ height: '100%' }}
                      className="rbc-calendar-rtl"
                      selectable={true}
                      step={15}
                      timeslots={1}
                      components={{ event: CustomEvent }}
                      currentUser={currentUser}
                      isCalendarFullView={isCalendarFullView}
                      taskCategories={taskCalendarData?.taskCategories || []}
                      users={taskCalendarData?.users || []}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}


          <div style={{ order: blockOrder.Leads }} className={`col-span-1 ${isFullView ? 'lg:col-span-12' : 'lg:col-span-4'} transition-all duration-300 ease-in-out`} >
            <LeadManager
              isFullView={isFullView}
              setIsFullView={setIsFullView}
              blockPosition={blockOrder.Leads}
              onToggleBlockOrder={() => toggleBlockOrder("Leads")}
              onCalendarDataChange={setLeadCalendarData}
            />
          </div>


          {showAnalytics && (
            <div className="col-span-12 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>{'ניתוח לידים'}</CardTitle>
                </CardHeader>
                <CardContent>

                  <div className="flex flex-wrap items-center gap-4 mb-4 pb-4 border-b">
                    <span className="font-medium text-sm">{'תקופת זמן:'}</span>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant={analyticsTimeFilter === 'week' ? 'default' : 'outline'} onClick={() => setAnalyticsTimeFilter('week')}>{'שבוע אחרון'}</Button>
                      <Button size="sm" variant={analyticsTimeFilter === 'month' ? 'default' : 'outline'} onClick={() => setAnalyticsTimeFilter('month')}>{'חודש נוכחי'}</Button>
                      <Button size="sm" variant={analyticsTimeFilter === 'last_month' ? 'default' : 'outline'} onClick={() => setAnalyticsTimeFilter('last_month')}>{'חודש קודם'}</Button>
                      <Button size="sm" variant={analyticsTimeFilter === 'custom' ? 'default' : 'outline'} onClick={() => setAnalyticsTimeFilter('custom')}>{'מותאם'}</Button>
                    </div>
                    {analyticsTimeFilter === 'custom' && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Label className="text-sm">{'מ:'}</Label><Input type="date" value={analyticsFilterFrom} onChange={(e) => setAnalyticsFilterFrom(e.target.value)} className="h-8 text-sm w-[140px]" />
                        <Label className="text-sm">{'עד:'}</Label><Input type="date" value={analyticsFilterTo} onChange={(e) => setAnalyticsFilterTo(e.target.value)} className="h-8 text-sm w-[140px]" />
                      </div>
                    )}
                  </div>

                  {!calculatedAnalytics ? (
                    <p className="text-center text-gray-500">{'טוען נתונים...'}</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                      <div>
                        <h4 className="font-semibold mb-2 text-center">{'סיכום ('}{calculatedAnalytics.range.start} - {calculatedAnalytics.range.end}{')'}</h4>
                        <table className="w-full text-sm text-right border">
                          <tbody>
                            <tr className="border-b"><td className="p-2 font-medium">{'סה"כ לידים:'}</td><td className="p-2">{calculatedAnalytics.totalLeads}</td></tr>
                            <tr className="border-b"><td className="p-2 font-medium">{'ממוצע ליום:'}</td><td className="p-2">{calculatedAnalytics.leadsPerDay}</td></tr>
                            <tr className="border-b bg-yellow-50"><td className="p-2 font-bold">{'שיעור המרה ראשון:'}</td><td className="p-2 font-bold">{calculatedAnalytics.firstConversionRate}%</td></tr>
                            <tr className="border-b bg-blue-50"><td className="p-2 font-bold">{'שיעור המרה שני:'}</td><td className="p-2 font-bold">{calculatedAnalytics.secondConversionRate}%</td></tr>
                            <tr className="border-b"><td className="p-2 font-medium">{'זמן מענה ממוצע:'}</td><td className="p-2">{calculatedAnalytics.avgAnswerTimeHours}</td></tr>
                            <tr className="bg-gray-100 font-medium border-b"><td className="p-2" colSpan={2}>{'סטטוסים:'}</td></tr>
                            {Object.entries(calculatedAnalytics.statusCounts).map(([s, c]) => (<tr key={s} className="border-b"><td className="p-2 pl-4">{s}</td><td className="p-2">{c}</td></tr>))}
                            <tr className="bg-gray-100 font-medium border-b"><td className="p-2" colSpan={2}>{'מקורות:'}</td></tr>
                            {Object.entries(calculatedAnalytics.sourceCounts).map(([s, c]) => (<tr key={s} className="border-b"><td className="p-2 pl-4">{s}</td><td className="p-2">{c} ({calculatedAnalytics.totalLeads > 0 ? ((c / calculatedAnalytics.totalLeads) * 100).toFixed(1) : 0}%)</td></tr>))}
                          </tbody>
                        </table>
                      </div>

                      <div className="space-y-6">
                        {/* Enhanced Lead Inflow Chart */}
                        <div className="min-h-[300px]">
                          <h4 className="font-semibold mb-2 text-center">{'לידים נכנסים לפי יום'}</h4>
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={calculatedAnalytics.graphData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis
                                dataKey="name"
                                style={{ fontSize: '0.75rem' }}
                                tick={{ fill: '#666' }}
                                axisLine={{ stroke: '#ddd' }}
                              />
                              <YAxis
                                allowDecimals={false}
                                style={{ fontSize: '0.75rem' }}
                                tick={{ fill: '#666' }}
                                axisLine={{ stroke: '#ddd' }}
                              />
                              <RechartsTooltip
                                contentStyle={{
                                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                  border: '1px solid #ddd',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                                }}
                                labelStyle={{ fontWeight: 'bold', color: '#333' }}
                              />
                              <Legend wrapperStyle={{ paddingTop: '10px' }} />
                              <Line
                                type="monotone"
                                dataKey="received"
                                name="לידים נכנסים"
                                stroke="#3b82f6"
                                strokeWidth={3}
                                activeDot={{ r: 8, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                                dot={{ r: 4, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                              />
                              <Area
                                type="monotone"
                                dataKey="received"
                                fill="url(#leadGradient)"
                                fillOpacity={0.3}
                              />
                              <defs>
                                <linearGradient id="leadGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                                </linearGradient>
                              </defs>
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Conversion Funnel Chart */}
                        <div className="min-h-[250px]">
                          <h4 className="font-semibold mb-2 text-center">{'מנהרת המרה'}</h4>
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart
                              data={[
                                {
                                  name: 'לידים אמיתיים',
                                  value: calculatedAnalytics.totalLeads - (calculatedAnalytics.statusCounts['באג'] || 0),
                                  color: '#6b7280'
                                },
                                {
                                  name: 'נקבע יעוץ',
                                  value: calculatedAnalytics.statusCounts['נקבע יעוץ'] || 0,
                                  color: '#f59e0b'
                                },
                                {
                                  name: 'נקבעה סדרה',
                                  value: calculatedAnalytics.statusCounts['נקבעה סדרה'] || 0,
                                  color: '#10b981'
                                }
                              ]}
                              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis
                                dataKey="name"
                                style={{ fontSize: '0.75rem' }}
                                tick={{ fill: '#666' }}
                              />
                              <YAxis
                                style={{ fontSize: '0.75rem' }}
                                tick={{ fill: '#666' }}
                              />
                              <RechartsTooltip
                                contentStyle={{
                                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                  border: '1px solid #ddd',
                                  borderRadius: '8px'
                                }}
                                formatter={(value, name) => [value, name]}
                              />
                              <Bar
                                dataKey="value"
                                fill="#3b82f6"
                                radius={[4, 4, 0, 0]}
                              >
                                {[
                                  {
                                    name: 'לידים אמיתיים',
                                    value: calculatedAnalytics.totalLeads - (calculatedAnalytics.statusCounts['באג'] || 0),
                                    color: '#6b7280'
                                  },
                                  {
                                    name: 'נקבע יעוץ',
                                    value: calculatedAnalytics.statusCounts['נקבע יעוץ'] || 0,
                                    color: '#f59e0b'
                                  },
                                  {
                                    name: 'נקבעה סדרה',
                                    value: calculatedAnalytics.statusCounts['נקבעה סדרה'] || 0,
                                    color: '#10b981'
                                  }
                                ].map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Status Distribution Pie Chart */}
                        <div className="min-h-[300px]">
                          <h4 className="font-semibold mb-2 text-center">{'התפלגות סטטוסים'}</h4>
                          <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                              <Pie
                                data={Object.entries(calculatedAnalytics.statusCounts)
                                  .filter(([status, count]) => count > 0)
                                  .map(([status, count]) => ({
                                    name: status,
                                    value: count
                                  }))}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                {Object.entries(calculatedAnalytics.statusCounts)
                                  .filter(([status, count]) => count > 0)
                                  .map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899'][index % 9]} />
                                  ))}
                              </Pie>
                              <RechartsTooltip
                                contentStyle={{
                                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                  border: '1px solid #ddd',
                                  borderRadius: '8px'
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Performance Metrics Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-blue-600">
                                {calculatedAnalytics.firstConversionRate}%
                              </div>
                              <div className="text-sm text-blue-700 font-medium">
                                המרה ראשונה
                              </div>
                              <div className="text-xs text-blue-600 mt-1">
                                לידים → יעוץ
                              </div>
                            </div>
                          </div>

                          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-green-600">
                                {calculatedAnalytics.secondConversionRate}%
                              </div>
                              <div className="text-sm text-green-700 font-medium">
                                המרה שנייה
                              </div>
                              <div className="text-xs text-green-600 mt-1">
                                יעוץ → סדרה
                              </div>
                            </div>
                          </div>

                          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-purple-600">
                                {calculatedAnalytics.leadsPerDay}
                              </div>
                              <div className="text-sm text-purple-700 font-medium">
                                ממוצע ליום
                              </div>
                              <div className="text-xs text-purple-600 mt-1">
                                לידים חדשים
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Fixed Tasks Analytics Section */}
                  <div className="mt-8 pt-8 border-t">
                    <FixedTasksAnalytics
                      timeFilter={analyticsTimeFilter}
                      filterFrom={analyticsFilterFrom}
                      filterTo={analyticsFilterTo}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Call Log Dashboard (Admin Only) */}
          {showCallLogDashboard && (currentUserData?.role === 'admin' || role === 'admin') && (
            <div className="col-span-12 mt-4">
              <CallLogDashboard />
            </div>
          )}

        </div>







        {false && showReturnModal && (
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


        {false && showHistoryModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 p-4" onClick={() => setShowHistoryModal(false)}>
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4 shrink-0 text-right">{'היסטוריית משימות שבוצעו'}</h2>
              <div className="overflow-y-auto flex-grow mb-4 border rounded p-2 bg-gray-50">
                <ul className="space-y-2">
                  {archivedTasks
                    .sort((a, b) => {
                      const aTime = a.completedAt?.toDate ? a.completedAt.toDate().getTime() : new Date(a.completedAt).getTime();
                      const bTime = b.completedAt?.toDate ? b.completedAt.toDate().getTime() : new Date(b.completedAt).getTime();
                      return bTime - aTime;
                    })
                    .map(task => {
                      // Convert Firestore Timestamps to JS Dates if needed
                      const createdAt = task.createdAt?.toDate ? task.createdAt.toDate() : new Date(task.createdAt);
                      const completedAt = task.completedAt?.toDate ? task.completedAt.toDate() : new Date(task.completedAt);
                      let duration = "";
                      if (completedAt && createdAt && !isNaN(completedAt.getTime()) && !isNaN(createdAt.getTime())) {
                        try {


                          const durationMs = completedAt.getTime() - createdAt.getTime();
                          duration = formatDuration(durationMs);
                        } catch { duration = "N/A"; }
                      }
                      // Find latest reply if any
                      let latestReply = null;
                      if (Array.isArray(task.replies) && task.replies.length > 0) {
                        latestReply = task.replies.reduce((latest, curr) => {
                          const currTime = curr.timestamp?.toDate ? curr.timestamp.toDate().getTime() : new Date(curr.timestamp).getTime();
                          const latestTime = latest ? (latest.timestamp?.toDate ? latest.timestamp.toDate().getTime() : new Date(latest.timestamp).getTime()) : 0;
                          return currTime > latestTime ? curr : latest;
                        }, null);
                      }
                      // Prefer alias for completedBy if available
                      const completedBy = task.completedByAlias || task.completedBy || task.completedByEmail || 'לא ידוע';
                      return (
                        <li key={`hist-${task.id}`} className="p-2 border rounded bg-white text-sm text-right">
                          <div className="font-medium">
                            {task.title}{task.subtitle ? ` - ${task.subtitle}` : ''}
                          </div>
                          {latestReply && latestReply.text && (
                            <div className="text-xs text-blue-700 mt-1 border-b pb-1">{latestReply.text}</div>
                          )}
                          <div className="text-xs text-gray-600 mt-1">
                            {'בוצע על ידי '}
                            <span className="font-semibold">{completedBy}</span>
                            {' בתאריך '}
                            <span className="font-semibold">{formatDateTime(completedAt)}</span>
                            {duration && <span className="ml-2 mr-2 pl-2 border-l">{'משך: '}<span className="font-semibold">{duration}</span></span>}
                          </div>
                          {currentUser?.role === 'admin' && (
                            <Button variant="outline" size="sm" className="mt-2" onClick={() => restoreTask(task)}>
                              {'שחזר משימה'}
                            </Button>
                          )}
                        </li>
                      );
                    })
                  }
                  {archivedTasks.length === 0 && (
                    <li className="text-center text-gray-500 py-6">{'אין משימות בהיסטוריה.'}</li>
                  )}
                </ul>
              </div>
              <div className="mt-auto pt-4 border-t flex justify-end shrink-0">
                <Button variant="outline" onClick={() => setShowHistoryModal(false)}>{'סגור'}</Button>
              </div>
            </div>
          </div>
        )}


        {false && showAddLeadModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 p-4" onClick={() => setShowAddLeadModal(false)}>
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4 text-right">{'הוספת ליד חדש'}</h2>
              <form onSubmit={handleAddNewLead} className="space-y-4 text-right" dir="rtl">

                <div>
                  <Label htmlFor="new-lead-name" className="block text-sm font-medium mb-1">שם מלא <span className="text-red-500">*</span></Label>
                  <Input
                    id="new-lead-name" type="text" value={newLeadFullName}
                    onChange={(e) => setNewLeadFullName(e.target.value)} required
                  />
                </div>

                <div>
                  <Label htmlFor="new-lead-phone" className="block text-sm font-medium mb-1">מספר טלפון <span className="text-red-500">*</span></Label>
                  <Input
                    id="new-lead-phone" type="tel" value={newLeadPhone}
                    onChange={(e) => setNewLeadPhone(e.target.value)} required
                  />
                </div>

                <div>
                  <Label htmlFor="new-lead-message" className="block text-sm font-medium mb-1">הודעה / הערה</Label>
                  <Textarea
                    id="new-lead-message" value={newLeadMessage}
                    onChange={(e) => setNewLeadMessage(e.target.value)} rows={3}
                    placeholder="פרטים ראשוניים, סיבת פניה..."
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="new-lead-hot"
                    checked={newLeadIsHot}
                    onChange={(e) => setNewLeadIsHot(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <Label htmlFor="new-lead-hot" className="text-sm font-medium">ליד חם 🔥</Label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="new-lead-status" className="block text-sm font-medium mb-1">סטטוס</Label>
                    <Select value={newLeadStatus} onValueChange={setNewLeadStatus}>
                      <SelectTrigger id="new-lead-status"><SelectValue placeholder="בחר סטטוס..." /></SelectTrigger>
                      <SelectContent>

                        {Object.keys(leadStatusConfig).filter(k => k !== 'Default').map(status => (
                          <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="new-lead-source" className="block text-sm font-medium mb-1">מקור הגעה</Label>
                    <Input
                      id="new-lead-source" type="text" value={newLeadSource}
                      onChange={(e) => setNewLeadSource(e.target.value)}
                      placeholder="לדוגמא: פייסבוק, טלפון, המלצה..."
                    />
                    <Label className="block">
                      <span className="text-gray-700 text-sm font-medium">{'סניף:'}</span>
                      <Select value={editLeadBranch} onValueChange={setEditLeadBranch}>
                        <SelectTrigger className="mt-1 h-8 text-sm">
                          <SelectValue placeholder="בחר סניף..." />
                        </SelectTrigger>
                        <SelectContent>
                          {BRANCHES.filter(b => b.value).map(b => (
                            <SelectItem key={b.value} value={b.value}>
                              <span className={`inline-block w-3 h-3 rounded-full mr-2 align-middle ${b.color}`}></span>
                              {b.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Label>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <Button type="submit">הוסף ליד</Button>
                  <Button type="button" variant="outline" onClick={() => setShowAddLeadModal(false)}>ביטול</Button>
                </div>
              </form>
            </div>
          </div>
        )}








      </DndContext>



      {/* Duplicate Confirmation Modal */}
      {showDuplicateConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 p-4" onClick={() => setShowDuplicateConfirm(false)}>
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4 text-right">אישור שכפול ליד</h2>
            <p className="text-gray-600 mb-6 text-right">
              האם את בטוחה שאת רוצה לשכפל את הליד הזה?
            </p>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDuplicateConfirm(false)}
                className="px-4 py-2"
              >
                ביטול
              </Button>
              <Button
                type="button"
                onClick={handleConfirmDuplicate}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white"
              >
                כן, שכפל
              </Button>
            </div>
          </div>
        </div>
      )}
    </TooltipProvider>
  );
}



// Add a custom event component for the calendar
const CustomEvent = ({ event }) => {
  // Format the start time as HH:mm
  const startTime = event.start instanceof Date
    ? event.start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '';
  return (
    <div style={{ fontSize: '0.95em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2, direction: 'rtl' }}>
      <span style={{ fontWeight: 'normal', marginLeft: 4 }}>{startTime}</span>
      <strong>{event.title}</strong>
    </div>
  );
};

// Add this function for click2call






