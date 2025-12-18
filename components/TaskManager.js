"use client";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../firebase";
import { useAuth } from "@/app/context/AuthContext";
import { useData } from "@/app/context/DataContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, RotateCcw, Bell, ChevronDown, Pencil, MessageCircle, ChevronLeft } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { horizontalListSortingStrategy } from "@dnd-kit/sortable";
import SortableCategoryColumn from "./ui/sortable-category-column";
import SortableItem from "./ui/sortable-item";
import { useToast } from "@/components/ui/use-toast";
import { styled } from '@mui/material/styles';
import { Switch as MuiSwitch } from '@mui/material';
import { FaWhatsapp } from "react-icons/fa";
import { BRANCHES, branchColor } from "@/lib/branches";
import { 
  collection, getDocs, getDoc, addDoc, updateDoc, onSnapshot, setDoc, doc, deleteDoc, serverTimestamp, arrayUnion, orderBy, query, Timestamp
} from "firebase/firestore";
import { TaskTabs } from "./TaskTabs";
import { logActivity } from "@/lib/activityLogger";

// Local utilities/constants duplicated to minimize risk during extraction
const taskPriorities = ["דחוף", "רגיל", "נמוך"];
// BRANCHES and branchColor are shared from lib/branches

// Category name mappings to ensure consistency (old → new)
const categoryNameMappings = {
  'תוכנית טיפול': 'תוכניות טיפול',  // singular → plural
  'תשלומים': 'תשלומים וזיכויים'       // short → full
};

const normalizeCategory = (s) => {
  if (typeof s !== 'string') return s;
  // First normalize whitespace
  let normalized = s.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
  // Then apply category name mappings
  return categoryNameMappings[normalized] || normalized;
};

function formatDateTime(date) {
  if (!date) return "";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return `${d.toLocaleDateString("he-IL")} ${d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  } catch { return ""; }
}

function formatDuration(ms) {
  if (typeof ms !== 'number' || ms < 0 || isNaN(ms)) return "";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} ${days === 1 ? 'יום' : 'ימים'}`;
  if (hours > 0) return `${hours} ${hours === 1 ? 'שעה' : 'שעות'}`;
  if (minutes > 0) return `${minutes} ${minutes === 1 ? 'דקה' : 'דקות'}`;
  return "< דקה";
}

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

export default function TaskManager({ isTMFullView, setIsTMFullView, blockPosition, onToggleBlockOrder, onCalendarDataChange, handleClick2Call, fixedTasksVisible, onToggleFixedTasks }) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const { tasks, setTasks, users, assignableUsers, currentUserData } = useData();
  const alias = currentUserData?.alias || "";
  const role = currentUserData?.role || "";
  const userExt = currentUserData?.EXT || "";
  
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

  const [replyingToTaskId, setReplyingToTaskId] = useState(null);
  const [showOverdueEffects, setShowOverdueEffects] = useState(true);
  const [replyInputValue, setReplyInputValue] = useState("");
  const [kanbanCollapsed, setKanbanCollapsed] = useState({});
  const [kanbanTaskCollapsed, setKanbanTaskCollapsed] = useState({});
  const defaultTaskCategories = ["תוכניות טיפול", "לקבוע סדרה", "תשלומים וזיכויים", "דוחות", "להתקשר", "אחר"];
  const [taskCategories, setTaskCategories] = useState(defaultTaskCategories);
  const [taskFilter, setTaskFilter] = useState("הכל");
  const [taskPriorityFilter, setTaskPriorityFilter] = useState("all");
  const [selectedTaskCategories, setSelectedTaskCategories] = useState(defaultTaskCategories);
  const [taskSearchTerm, setTaskSearchTerm] = useState("");
  const [showDoneTasks, setShowDoneTasks] = useState(false);
  const [userHasSortedTasks, setUserHasSortedTasks] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const savedSelectedRef = useRef(null);
  const hasLoadedFromFirestore = useRef(false);

  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingAssignTo, setEditingAssignTo] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [editingSubtitle, setEditingSubtitle] = useState("");
  const [editingPriority, setEditingPriority] = useState("רגיל");
  const [editingCategory, setEditingCategory] = useState(taskCategories[0] || "");
  const [editingDueDate, setEditingDueDate] = useState("");
  const [editingDueTime, setEditingDueTime] = useState("");
  const [editingBranch, setEditingBranch] = useState("");

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskSubtitle, setNewTaskSubtitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("רגיל");
  const [newTaskCategory, setNewTaskCategory] = useState(taskCategories[0] || "");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskDueTime, setNewTaskDueTime] = useState("");
  const [newTaskAssignTo, setNewTaskAssignTo] = useState("");
  const [newTaskBranch, setNewTaskBranch] = useState("");

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [archivedTasks, setArchivedTasks] = useState([]);
  const [showNudgesModal, setShowNudgesModal] = useState(false);
  const [selectedTaskForNudges, setSelectedTaskForNudges] = useState(null);
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [userHasExplicitlyChangedPrefs, setUserHasExplicitlyChangedPrefs] = useState(false);

  // Helper to mark that user has explicitly changed preferences
  const markPrefsChanged = useCallback(() => {
    console.log('🔔 TaskManager: User explicitly changed preferences - enabling persistence');
    setUserHasExplicitlyChangedPrefs(true);
    setPersistenceReady(true); // Enable persistence now that user has made a change
  }, []);

  // Load persisted task filters/preferences from Firestore
  useEffect(() => {
    if (!currentUser) {
      console.log('📥 TaskManager: No currentUser, skipping load');
      return;
    }
    console.log('📥 TaskManager: Starting to load preferences for user:', currentUser.uid);
    const loadPrefs = async () => {
      try {
        // Small delay to ensure Firebase is fully initialized
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const userRef = doc(db, 'users', currentUser.uid);
        console.log('🔍 TaskManager: Fetching user document for UID:', currentUser.uid);
        const snap = await getDoc(userRef);
        console.log('🔍 TaskManager: Got snapshot, exists:', snap.exists(), 'fromCache:', snap.metadata.fromCache);
        
        const allCategories = ["תוכניות טיפול", "לקבוע סדרה", "תשלומים וזיכויים", "דוחות", "להתקשר", "אחר"];
        
        if (snap.exists()) {
          hasLoadedFromFirestore.current = true;
          const d = snap.data();
          console.log('📥 TaskManager: User document exists:', {
            tm_selectedTaskCategories: d.tm_selectedTaskCategories,
            hasField: 'tm_selectedTaskCategories' in d,
            isArray: Array.isArray(d.tm_selectedTaskCategories)
          });
          if (d.tm_taskFilter) setTaskFilter(d.tm_taskFilter);
          if (d.tm_taskPriorityFilter) setTaskPriorityFilter(d.tm_taskPriorityFilter);
          if ('tm_selectedTaskCategories' in d && Array.isArray(d.tm_selectedTaskCategories)) {
            // Ensure all categories from the master list are represented
            // If a category is in the saved list, keep it; if it's in allCategories but not saved, include it too
            const normalizedSaved = d.tm_selectedTaskCategories.map(normalizeCategory);
            const normalizedAll = allCategories.map(normalizeCategory);
            
            // Check if any master categories are missing from saved preferences
            const missingCategories = allCategories.filter(cat => 
              !normalizedSaved.includes(normalizeCategory(cat))
            );
            
            // Always use normalized versions to ensure consistency
            let finalCategories = normalizedSaved;
            if (missingCategories.length > 0) {
              console.log('⚠️ Found missing categories in saved prefs:', missingCategories);
              // Add missing categories to the saved list
              finalCategories = [...normalizedSaved, ...missingCategories];
              console.log('🔧 Fixed categories:', finalCategories);
            }
            
            console.log('✅ TaskManager: Setting loaded categories:', finalCategories);
            savedSelectedRef.current = finalCategories;
            setSelectedTaskCategories(finalCategories);
          } else {
            console.log('⚠️ TaskManager: No saved categories, defaulting to all:', allCategories);
            savedSelectedRef.current = allCategories;
            setSelectedTaskCategories(allCategories);
          }
          if (typeof d.tm_taskSearchTerm === 'string') setTaskSearchTerm(d.tm_taskSearchTerm);
          if (typeof d.tm_showDoneTasks === 'boolean') setShowDoneTasks(d.tm_showDoneTasks);
          if (typeof d.tm_showOverdueEffects === 'boolean') setShowOverdueEffects(d.tm_showOverdueEffects);
          // Load collapse states
          console.log('🔍 TaskManager: Checking collapse states in Firebase:', {
            hasKanbanCollapsed: 'kanbanCollapsed' in d,
            kanbanCollapsedType: typeof d.kanbanCollapsed,
            kanbanCollapsedValue: d.kanbanCollapsed,
            hasKanbanTaskCollapsed: 'kanbanTaskCollapsed' in d,
            kanbanTaskCollapsedType: typeof d.kanbanTaskCollapsed,
            kanbanTaskCollapsedValue: d.kanbanTaskCollapsed
          });
          if (d.kanbanCollapsed && typeof d.kanbanCollapsed === 'object') {
            console.log('✅ TaskManager: Loading kanbanCollapsed from Firebase:', d.kanbanCollapsed);
            setKanbanCollapsed(d.kanbanCollapsed);
          } else {
            console.log('⚠️ TaskManager: No kanbanCollapsed found in Firebase, keeping default {}');
          }
          if (d.kanbanTaskCollapsed && typeof d.kanbanTaskCollapsed === 'object') {
            console.log('✅ TaskManager: Loading kanbanTaskCollapsed from Firebase:', d.kanbanTaskCollapsed);
            setKanbanTaskCollapsed(d.kanbanTaskCollapsed);
          } else {
            console.log('⚠️ TaskManager: No kanbanTaskCollapsed found in Firebase, keeping default {}');
          }
        } else {
          hasLoadedFromFirestore.current = false; // NOT loaded from Firestore
          console.log('⚠️ TaskManager: No user document exists yet, defaulting to all categories:', allCategories);
          console.log('⚠️ TaskManager: Will NOT auto-save defaults - waiting for explicit user changes');
          savedSelectedRef.current = allCategories;
          setSelectedTaskCategories(allCategories);
          // Don't enable persistence for defaults - only when user explicitly changes something
        }
        console.log('✅ TaskManager: Setting prefsLoaded=true');
        setPrefsLoaded(true);
      } catch (err) {
        console.error('❌ TaskManager: Error loading prefs:', err);
        const allCategories = ["תוכניות טיפול", "לקבוע סדרה", "תשלומים וזיכויים", "דוחות", "להתקשר", "אחר"];
        savedSelectedRef.current = allCategories;
        setSelectedTaskCategories(allCategories);
        setPrefsLoaded(true);
      }
    };
    loadPrefs();
  }, [currentUser]);

  // Set persistenceReady in a separate effect after prefsLoaded is true
  // This ensures proper timing and prevents race conditions
  useEffect(() => {
    if (prefsLoaded && hasLoadedFromFirestore.current) {
      console.log('✅ TaskManager: Setting persistenceReady=true (after prefs loaded)');
      setPersistenceReady(true);
    }
  }, [prefsLoaded]);

  // Persist task filters/preferences to Firestore
  useEffect(() => {
    if (!currentUser || !prefsLoaded) {
      console.log('💾 TaskManager: Skipping persistence:', { currentUser: !!currentUser, prefsLoaded, persistenceReady, userHasExplicitlyChangedPrefs });
      return;
    }
    
    // Only persist if:
    // 1. We successfully loaded existing preferences (persistenceReady), OR
    // 2. User has explicitly changed something (userHasExplicitlyChangedPrefs)
    if (!persistenceReady && !userHasExplicitlyChangedPrefs) {
      console.log('💾 TaskManager: Skipping persistence - no existing prefs loaded and no explicit changes yet');
      return;
    }
    
    // Only persist if we've successfully loaded preferences from Firestore OR user has explicitly changed something
    // This prevents persisting defaults before we've tried to load
    if (!hasLoadedFromFirestore.current && !userHasExplicitlyChangedPrefs) {
      console.log('💾 TaskManager: Skipping persistence - waiting for Firestore load');
      return;
    }
    
    console.log('💾 TaskManager: Persisting preferences:', {
      selectedTaskCategories,
      taskFilter,
      taskPriorityFilter,
      taskSearchTerm,
      showDoneTasks,
      showOverdueEffects,
      kanbanCollapsed,
      kanbanTaskCollapsed,
      uid: currentUser.uid
    });
    
    // Update the ref to keep it in sync with current selection
    savedSelectedRef.current = selectedTaskCategories;
    const userRef = doc(db, 'users', currentUser.uid);
    
    const dataToSave = {
      tm_taskFilter: taskFilter,
      tm_taskPriorityFilter: taskPriorityFilter,
      tm_selectedTaskCategories: selectedTaskCategories,
      tm_taskSearchTerm: taskSearchTerm,
      tm_showDoneTasks: showDoneTasks,
      tm_showOverdueEffects: showOverdueEffects,
      kanbanCollapsed: kanbanCollapsed,
      kanbanTaskCollapsed: kanbanTaskCollapsed,
      updatedAt: serverTimestamp(),
    };
    
    console.log('💾 TaskManager: Data to save:', dataToSave);
    
    setDoc(userRef, dataToSave, { merge: true })
      .then(() => {
        console.log('✅ TaskManager: Successfully wrote to Firestore!');
        console.log('✅ TaskManager: Saved data:', dataToSave);
        // Once we've saved once, enable persistence for future changes
        if (!persistenceReady) {
          setPersistenceReady(true);
        }
      })
      .catch((err) => {
        console.error('❌ TaskManager: Error persisting:', err);
        console.error('❌ TaskManager: Failed to save:', dataToSave);
      });
  }, [currentUser, prefsLoaded, persistenceReady, userHasExplicitlyChangedPrefs, taskFilter, taskPriorityFilter, selectedTaskCategories, taskSearchTerm, showDoneTasks, showOverdueEffects, kanbanCollapsed, kanbanTaskCollapsed]);

  // Users now come from DataContext - no need to fetch

  // Kanban category order persistence in Firestore
  // This listener is ONLY for category ORDER changes (drag & drop in kanban view)
  // It should NOT affect which categories are selected/checked
  useEffect(() => {
    if (!currentUser) return;
    console.log('👂 Starting onSnapshot listener for kanban order');
    const userRef = doc(db, 'users', currentUser.uid);
    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        console.log('🔔 onSnapshot fired, kanbanCategoryOrder:', data.kanbanCategoryOrder);
        // ONLY update the category ORDER, not the selection
        // Apply normalization to ensure consistency (e.g., "תוכנית טיפול" → "תוכניות טיפול")
        if (Array.isArray(data.kanbanCategoryOrder) && data.kanbanCategoryOrder.length > 0) {
          const normalizedOrder = data.kanbanCategoryOrder.map(normalizeCategory);
          console.log('📋 Updating category ORDER only (not selection)');
          setTaskCategories(normalizedOrder);
          // DO NOT update selectedTaskCategories here - that's handled separately by the prefs loader
        }
      }
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Fetch archived tasks for history modal
  useEffect(() => {
    if (!currentUser) return;
    const archivedRef = collection(db, "archivedTasks");
    const unsubscribe = onSnapshot(archivedRef, (snapshot) => {
      const data = snapshot.docs.map(docu => docu.data());
      setArchivedTasks(data);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Listen for nudge notifications
  useEffect(() => {
    if (!currentUser) return;
    
    const notificationsRef = collection(db, "notifications");
    const q = query(
      notificationsRef,
      orderBy("createdAt", "desc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const notif = change.doc.data();
          // Only show toast for new nudge notifications intended for current user
          if (notif.type === 'task_nudge' && 
              !notif.isRead && 
              (notif.recipientId === currentUser.email || 
               notif.recipientId === currentUser.uid ||
               notif.recipientId === alias)) {
            
            // Show toast to receiver
            toast({
              title: "תזכורת חדשה!",
              description: `${notif.senderAlias} שלח/ה לך תזכורת על: ${notif.taskTitle}`,
              duration: 5000,
            });
            
            // Mark notification as read to avoid showing it again
            const notifRef = doc(db, "notifications", change.doc.id);
            updateDoc(notifRef, { isRead: true }).catch(() => {});
          }
        }
      });
    });
    
    return () => unsubscribe();
  }, [currentUser, alias, toast]);

  const updateKanbanCategoryOrder = async (newOrder) => {
    setTaskCategories(newOrder);
    if (currentUser) {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, { kanbanCategoryOrder: newOrder });
    }
  };

  const handleCategoryDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = taskCategories.indexOf(active.id);
    const newIndex = taskCategories.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(taskCategories, oldIndex, newIndex);
    updateKanbanCategoryOrder(newOrder);
  };

  const handleToggleKanbanCollapse = async (category) => {
    markPrefsChanged();
    setKanbanCollapsed((prev) => {
      const updated = { ...prev, [category]: !prev[category] };
      console.log('🔄 TaskManager: Toggling kanban collapse:', { category, newState: updated });
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        updateDoc(userRef, { kanbanCollapsed: updated }).catch(err => console.error('Error saving kanbanCollapsed:', err));
      }
      return updated;
    });
  };

  const handleToggleTaskCollapse = async (taskId) => {
    markPrefsChanged();
    setKanbanTaskCollapsed((prev) => {
      const updated = { ...prev, [taskId]: !prev[taskId] };
      console.log('🔄 TaskManager: Toggling task collapse:', { taskId, newState: updated });
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        updateDoc(userRef, { kanbanTaskCollapsed: updated }).catch(err => console.error('Error saving kanbanTaskCollapsed:', err));
      }
      return updated;
    });
  };

  // Tasks now come from DataContext - no need for listener

  // Handlers
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const assignedUser = assignableUsersWithSelf.find(u => u.alias === newTaskAssignTo || u.email === newTaskAssignTo);
    
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
    await setDoc(taskRef, newTask);
    setNewTaskTitle("");
    setNewTaskSubtitle("");
    setNewTaskPriority("רגיל");
    setNewTaskCategory(taskCategories[0] || "");
    setNewTaskDueDate("");
    setNewTaskDueTime("");
    setNewTaskAssignTo("");
    setShowTaskModal(false);
    setNewTaskBranch('');
  };

  const handleTaskReply = async (taskId, replyText) => {
    if (!replyText.trim() || !currentUser) return;
    const taskRef = doc(db, 'tasks', taskId);
    const taskDoc = await getDoc(taskRef);
    if (!taskDoc.exists()) return;
    const taskData = taskDoc.data();
    const hasPermission = taskData.userId === currentUser.uid || taskData.creatorId === currentUser.uid || taskData.assignTo === currentUser.uid || taskData.assignTo === currentUser.email || taskData.assignTo === alias;
    if (!hasPermission) return;
    const now = Timestamp.fromDate(new Date());
    const newReply = { id: `reply-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, text: replyText, timestamp: now, userId: currentUser.uid, userEmail: currentUser.email, userAlias: alias || currentUser.email, isRead: false };
    const existingReplies = taskData.replies || [];
    await updateDoc(taskRef, { userId: taskData.userId, creatorId: taskData.creatorId, assignTo: taskData.assignTo, replies: [...existingReplies, newReply], hasNewReply: true, lastReplyAt: serverTimestamp(), updatedAt: serverTimestamp() });
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, replies: [...(t.replies || []), newReply], hasNewReply: true, lastReplyAt: now.toDate() } : t));
    setReplyingToTaskId(null);
  };

  const handleMarkReplyAsRead = async (taskId) => {
    const taskRef = doc(db, 'tasks', taskId);
    const taskDoc = await getDoc(taskRef);
    if (!taskDoc.exists()) return;
    const taskData = taskDoc.data();
    const updatedReplies = (taskData.replies || []).map(r => ({ ...r, isRead: true }));
    await updateDoc(taskRef, { replies: updatedReplies, hasNewReply: false, updatedAt: serverTimestamp() });
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, replies: updatedReplies, hasNewReply: false } : t));
  };

  const handleTaskDone = async (taskId, checked) => {
    const taskRef = doc(db, 'tasks', taskId);
    const taskDoc = await getDoc(taskRef);
    if (!taskDoc.exists()) return;
    const taskData = taskDoc.data();
    const now = new Date();
    const aliasToUse = alias || currentUser?.alias || currentUser?.email || taskData.assignTo || taskData.creatorAlias || taskData.creatorEmail || '';
    await updateDoc(taskRef, { done: checked, completedBy: checked ? (currentUser?.email || currentUser?.uid) : null, completedByAlias: checked ? aliasToUse : null, completedAt: checked ? now : null, updatedAt: serverTimestamp() });
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, done: checked, completedBy: checked ? (currentUser?.email || currentUser?.uid) : null, completedByAlias: checked ? aliasToUse : null, completedAt: checked ? now : null } : t));
  };

  const handleNudgeTask = async (taskId) => {
    if (!currentUser) return;
    try {
      const taskRef = doc(db, "tasks", taskId);
      const now = new Date();
      const newNudge = { timestamp: now, userId: currentUser.uid, userAlias: currentUser.alias || currentUser.email };
      const taskDoc = await getDoc(taskRef);
      const taskData = taskDoc.data();
      
      // Find the assignee's alias
      const assignee = assignableUsersWithSelf.find(u => u.email === taskData.assignTo || u.alias === taskData.assignTo);
      const assigneeAlias = assignee ? (assignee.alias || assignee.email) : taskData.assignTo;
      
      await updateDoc(taskRef, { nudges: arrayUnion(newNudge), lastNudgedAt: now, hasUnreadNudges: true, updatedAt: now });
      if (taskData.assignTo !== currentUser.email) {
        const notificationRef = doc(collection(db, "notifications"));
        await setDoc(notificationRef, { type: 'task_nudge', taskId, taskTitle: taskData.title, senderId: currentUser.uid, senderAlias: currentUser.alias || currentUser.email, recipientId: taskData.assignTo, recipientAlias: assigneeAlias, createdAt: now, isRead: false });
      }
      toast({ title: "תזכורת נשלחה", description: `נשלחה תזכורת ל-${assigneeAlias}` });
    } catch {
      toast({ title: "שגיאה", description: "לא ניתן היה לשלוח תזכורת", variant: "destructive" });
    }
  };

  const handleShowNudges = (task) => {
    setSelectedTaskForNudges(task);
    setShowNudgesModal(true);
  };

  const handleDismissNudges = async (taskId) => {
    if (!currentUser) return;
    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, { hasUnreadNudges: false, updatedAt: serverTimestamp() });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, hasUnreadNudges: false } : t));
      setShowNudgesModal(false);
      setSelectedTaskForNudges(null);
      toast({ title: "תזכורות נקראו", description: "התזכורות סומנו כנקראו" });
    } catch {
      toast({ title: "שגיאה", description: "לא ניתן לסמן תזכורות", variant: "destructive" });
    }
  };

  const handleEditTask = useCallback((task) => {
    if (!task) return;
    setShowTaskModal(false);
    setEditingTaskId(task.id);
    const assignedUser = assignableUsersWithSelf.find(
      (u) => u.email === task.assignTo || u.alias === task.assignTo
    );
    setEditingAssignTo(assignedUser ? (assignedUser.alias || assignedUser.email) : (task.assignTo || ""));
    setEditingTitle(task.title || "");
    setEditingSubtitle(task.subtitle || "");
    setEditingPriority(task.priority || "רגיל");
    setEditingCategory(task.category || taskCategories[0] || "");
    setEditingBranch(task.branch || "");
    let parsedDue = null;
    if (task.dueDate) {
      if (task.dueDate instanceof Date) {
        parsedDue = task.dueDate;
      } else if (typeof task.dueDate?.toDate === 'function') {
        parsedDue = task.dueDate.toDate();
      } else {
        const tentative = new Date(task.dueDate);
        if (!isNaN(tentative.getTime())) parsedDue = tentative;
      }
    }
    if (parsedDue && !isNaN(parsedDue.getTime())) {
      setEditingDueDate(parsedDue.toLocaleDateString('en-CA'));
      setEditingDueTime(parsedDue.toTimeString().slice(0, 5));
    } else {
      setEditingDueDate("");
      setEditingDueTime("");
    }
    setKanbanCollapsed((prev) => (task.category ? { ...prev, [task.category]: false } : prev));
    setKanbanTaskCollapsed((prev) => ({ ...prev, [task.id]: false }));
  }, [taskCategories, assignableUsersWithSelf]);

  const handleSaveTask = useCallback(async (e) => {
    e.preventDefault();
    if (!editingTaskId) return;
    let dueDateTime = null;
    try {
      if (editingDueDate && editingDueDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const timeString = editingDueTime || "00:00";
        const dateTimeStr = `${editingDueDate}T${timeString}:00`;
        const newDate = new Date(dateTimeStr);
        if (!isNaN(newDate.getTime())) dueDateTime = newDate;
      }
    } catch {}
    const assignedUser = assignableUsersWithSelf.find(
      (u) => u.alias === editingAssignTo || u.email === editingAssignTo
    );
    const assignToValue = assignedUser ? assignedUser.email : editingAssignTo;
    try {
      const taskRef = doc(db, "tasks", editingTaskId);
      await updateDoc(taskRef, {
        assignTo: assignToValue,
        title: editingTitle,
        subtitle: editingSubtitle,
        priority: editingPriority,
        category: editingCategory,
        dueDate: dueDateTime ? dueDateTime.toISOString() : null,
        branch: editingBranch || null,
        done: false,
        completedBy: null,
        completedAt: null,
        updatedAt: serverTimestamp(),
      });

      // Log activity for task update
      if (currentUser) {
        await logActivity(
          currentUser.uid,
          alias || currentUser.email,
          "update",
          "task",
          editingTaskId,
          { title: editingTitle, category: editingCategory }
        );
      }
    } catch {}
    setTasks(prev => prev.map(t => t.id === editingTaskId ? {
      ...t,
      assignTo: assignToValue,
      title: editingTitle,
      subtitle: editingSubtitle,
      priority: editingPriority,
      category: editingCategory,
      dueDate: dueDateTime ? dueDateTime : null,
      done: false,
      completedBy: null,
      completedAt: null,
      branch: editingBranch || null,
    } : t));
    setEditingTaskId(null);
    setEditingAssignTo("");
    setEditingTitle("");
    setEditingSubtitle("");
    setEditingPriority("רגיל");
    setEditingCategory(taskCategories[0] || "");
    setEditingDueDate("");
    setEditingDueTime("");
    setEditingBranch('');
  }, [editingTaskId, editingAssignTo, editingTitle, editingSubtitle, editingPriority, editingCategory, editingDueDate, editingDueTime, taskCategories, editingBranch, assignableUsersWithSelf]);

  const handleCancelEdit = useCallback(() => {
    setEditingTaskId(null);
    setEditingAssignTo("");
    setEditingTitle("");
    setEditingSubtitle("");
    setEditingPriority("רגיל");
    setEditingCategory(taskCategories[0] || "");
    setEditingDueDate("");
    setEditingDueTime("");
    setEditingBranch('');
  }, [taskCategories]);

  const handleClearDoneTasks = useCallback(async () => {
    if (!currentUser) return;
    if (!window.confirm("האם אתה בטוח שברצונך למחוק את כל המשימות שבוצעו? לא ניתן לשחזר פעולה זו.")) return;
    try {
      const completedTasks = tasks.filter(task => task.done && (task.userId === currentUser.uid || task.creatorId === currentUser.uid || task.assignTo === currentUser.email || task.assignTo === currentUser.alias));
      const archiveAndDeletePromises = completedTasks.map(async task => {
        try {
          const aliasToArchive = task.completedByAlias || task.completedBy || task.creatorAlias || task.creatorEmail || task.assignTo || alias || currentUser?.alias || currentUser?.email || '';
          await setDoc(doc(db, 'archivedTasks', task.id), { ...task, completedByAlias: aliasToArchive, archivedAt: new Date() });
          await deleteDoc(doc(db, 'tasks', task.id));
          return task.id;
        } catch { return null; }
      });
      const results = await Promise.allSettled(archiveAndDeletePromises);
      const successfulDeletes = results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
      setTasks(prev => prev.filter(t => !successfulDeletes.includes(t.id)));
      if (successfulDeletes.length < completedTasks.length) alert('חלק מהמשימות לא נמחקו עקב הרשאות חסרות');
    } catch {
      alert('שגיאה במחיקת המשימות שבוצעו');
    }
  }, [tasks, currentUser, alias]);

  // Restore task from archive (admin only)
  const restoreTask = async (archivedTask) => {
    if (!(currentUser?.role === 'admin' || role === 'admin')) {
      alert('רק אדמין יכול לשחזר משימות');
      return;
    }
    try {
      await setDoc(doc(db, 'tasks', archivedTask.id), {
        ...archivedTask,
        done: false,
        completedAt: null,
        completedBy: null,
        archivedAt: null,
        updatedAt: serverTimestamp(),
      });
      await deleteDoc(doc(db, 'archivedTasks', archivedTask.id));
      alert('המשימה שוחזרה בהצלחה');
    } catch {
      alert('שגיאה בשחזור המשימה');
    }
  };

  // Delete archived tasks older than 30 days
  const deleteOldArchivedTasks = async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const oldTasks = archivedTasks.filter(task => {
      const completedAt = task.completedAt?.toDate ? task.completedAt.toDate() : new Date(task.completedAt);
      return completedAt < thirtyDaysAgo;
    });

    if (oldTasks.length === 0) {
      alert('אין משימות ישנות למחיקה (מעל 30 יום)');
      return;
    }

    const confirmMsg = `נמצאו ${oldTasks.length} משימות שבוצעו לפני יותר מ-30 יום.\n\nהאם אתה בטוח שברצונך למחוק אותן לצמיתות?\nלא ניתן לשחזר פעולה זו.`;
    
    if (!window.confirm(confirmMsg)) return;

    try {
      const deletePromises = oldTasks.map(task => 
        deleteDoc(doc(db, 'archivedTasks', task.id))
      );
      
      await Promise.all(deletePromises);
      
      toast({
        title: "משימות נמחקו בהצלחה",
        description: `${oldTasks.length} משימות ישנות נמחקו מהארכיון`,
      });
    } catch (error) {
      console.error('Error deleting old archived tasks:', error);
      toast({
        title: "שגיאה",
        description: "לא ניתן למחוק חלק מהמשימות",
        variant: "destructive"
      });
    }
  };

  // DnD for tasks moving between categories
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [activeId, setActiveId] = useState(null);
  const handleDragStart = useCallback((event) => { setActiveId(event.active.id); }, []);
  const handleDragEnd = useCallback(async (event) => {
    const { active, over } = event; setActiveId(null);
    if (!over || !active) return;
    const taskId = active.id.replace('task-', '');
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    let targetElement = over.data.current?.droppableContainer?.node; let targetCategory = null;
    while (targetElement && !targetCategory) { targetCategory = targetElement.dataset?.category; if (!targetCategory) targetElement = targetElement.parentElement; }
    if (targetCategory && targetCategory !== task.category) {
      try {
        const taskRef = doc(db, 'tasks', taskId);
        await updateDoc(taskRef, { category: targetCategory, updatedAt: serverTimestamp() });
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, category: targetCategory, updatedAt: new Date() } : t));
      } catch { alert("שגיאה בעדכון קטגוריית המשימה"); }
    }
  }, [tasks]);

  // Render helpers
  const renderTask = (task) => {
    if (!task) {
      return (
        <div className="p-3 border rounded bg-blue-50 shadow-md">
          <form onSubmit={handleCreateTask} className="space-y-2">
            <div>
              <Label className="text-xs">מוקצה ל:</Label>
              <select value={newTaskAssignTo} onChange={(e) => setNewTaskAssignTo(e.target.value)} className="h-8 text-sm w-full border rounded">
                <option value="">בחר משתמש</option>
                {assignableUsersWithSelf.map((user) => (
                  <option key={user.id} value={user.alias || user.email}>{user.alias || user.email}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">כותרת:</Label>
              <Input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="h-8 text-sm" required onKeyDown={e => { if (e.key === ' ' || e.code === 'Space') e.stopPropagation(); }} />
            </div>
            <div>
              <Label className="text-xs">תיאור:</Label>
              <Textarea value={newTaskSubtitle} onChange={(e) => setNewTaskSubtitle(e.target.value)} rows={2} className="text-sm" onKeyDown={e => { if (e.key === ' ' || e.code === 'Space') e.stopPropagation(); if (e.key === 'Enter') e.stopPropagation(); }} />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-xs">עדיפות:</Label>
                <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{taskPriorities.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-xs">קטגוריה:</Label>
                <Select value={newTaskCategory} onValueChange={setNewTaskCategory}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{taskCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-xs">תאריך:</Label>
                <Input type="date" value={newTaskDueDate} onChange={(e) => setNewTaskDueDate(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="flex-1">
                <Label className="text-xs">שעה:</Label>
                <Input type="time" value={newTaskDueTime} onChange={(e) => setNewTaskDueTime(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
            <div className="flex-1">
              <Label className="text-xs">סניף:</Label>
              <Select
                value={newTaskBranch || "none"}
                onValueChange={(value) => setNewTaskBranch(value === "none" ? "" : value)}
              >
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="בחר סניף..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא</SelectItem>
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
              <Button type="button" size="sm" className="bg-red-600 hover:bg-red-700 text-white px-12" onClick={() => setShowTaskModal(false)}>{'ביטול'}</Button>
            </div>
          </form>
        </div>
      );
    }

    if (editingTaskId === task.id) {
      return (
        <div className="p-3 border rounded bg-blue-50 shadow-md">
          <form onSubmit={handleSaveTask} className="space-y-2">
            <div>
              <Label className="text-xs">מוקצה ל:</Label>
              <select
                value={editingAssignTo}
                onChange={(e) => setEditingAssignTo(e.target.value)}
                className="h-8 text-sm w-full border rounded"
              >
                <option value="">בחר משתמש</option>
                {assignableUsersWithSelf.map((user) => (
                  <option key={user.id || user.email} value={user.alias || user.email}>
                    {user.alias || user.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">כותרת:</Label>
              <Input
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                className="h-8 text-sm"
                required
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.code === 'Space') e.stopPropagation();
                }}
              />
            </div>
            <div>
              <Label className="text-xs">תיאור:</Label>
              <Textarea
                value={editingSubtitle}
                onChange={(e) => setEditingSubtitle(e.target.value)}
                rows={2}
                className="text-sm"
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.code === 'Space') e.stopPropagation();
                  if (e.key === 'Enter') e.stopPropagation();
                }}
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-xs">עדיפות:</Label>
                <Select value={editingPriority} onValueChange={setEditingPriority}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {taskPriorities.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-xs">קטגוריה:</Label>
                <Select value={editingCategory} onValueChange={setEditingCategory}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {taskCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-xs">תאריך:</Label>
                <Input
                  type="date"
                  value={editingDueDate}
                  onChange={(e) => setEditingDueDate(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs">שעה:</Label>
                <Input
                  type="time"
                  value={editingDueTime}
                  onChange={(e) => setEditingDueTime(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="flex-1">
              <Label className="text-xs">סניף:</Label>
              <Select
                value={editingBranch || "none"}
                onValueChange={(value) => setEditingBranch(value === "none" ? "" : value)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="בחר סניף..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא</SelectItem>
                  {BRANCHES.filter((b) => b.value).map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${b.color}`}>
                        {b.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="submit" size="sm" className="bg-green-600 hover:bg-green-700 text-white px-6">
                {'שמור'}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleCancelEdit}>
                {'ביטול'}
              </Button>
            </div>
          </form>
        </div>
      );
    }

    const hasUnreadReplies = task.replies?.some(reply => !reply.readBy?.includes(currentUser?.uid));
    const isCreator = task.createdBy === currentUser?.uid;
    const isAssignee = task.assignTo === currentUser?.uid;
    const bgColor = isCreator ? 'bg-blue-50' : isAssignee ? 'bg-green-50' : 'bg-white';
    const sortedReplies = task.replies?.sort((a, b) => b.timestamp - a.timestamp) || [];

    const renderTextWithPhone = (text) => {
      if (!text) return null;
      const regex = /(#05\d{8})/g;
      const parts = []; let lastIndex = 0; let match;
      while ((match = regex.exec(text)) !== null) {
        const phone = match[1]; const number = phone.slice(1);
        parts.push(text.slice(lastIndex, match.index));
        parts.push(
          <span key={match.index} className="inline-flex items-center gap-1">
            {phone}
            {handleClick2Call && (
              <Button size="xs" variant="ghost" className="p-0 ml-1 text-blue-600 hover:text-blue-800" onClick={() => handleClick2Call(number)} title="התקשר">
                <span role="img" aria-label="Call">📞</span>
              </Button>
            )}
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
              <Checkbox checked={!!task.done} onCheckedChange={(checked) => handleTaskDone(task.id, checked)} className="data-[state=checked]:bg-green-600" aria-label={`Mark task ${task.title}`} />
              <span className={`font-medium ${task.done ? 'line-through text-gray-500' : ''}`}>{renderTextWithPhone(task.title)}</span>
            </div>
            {task.subtitle && (<p className={`text-sm text-gray-600 mb-2 ${task.done ? 'line-through' : ''}`}>{renderTextWithPhone(task.subtitle)}</p>)}
            <div className="text-xs text-gray-500 mt-1 space-x-2 space-x-reverse">
              <span>🗓️ {formatDateTime(task.dueDate)}</span>
              <span>👤 {assignableUsersWithSelf.find(u => u.email === task.assignTo)?.alias || task.assignTo}</span>
              {task.creatorAlias && <span className="font-medium">📝 {task.creatorAlias}</span>}
              <span>🏷️ {task.category}</span>
              <span>{task.priority === 'דחוף' ? '🔥' : task.priority === 'נמוך' ? '⬇️' : '➖'} {task.priority}</span>
            </div>
            <TaskTabs taskId={task.id} currentUser={currentUser} />
          </div>
          <div className="flex flex-col items-end gap-1 min-w-[70px]">
            {task.branch && (<span className={`mb-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${branchColor(task.branch)}`}>{task.branch}</span>)}
            <div className="flex items-center gap-1">
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditTask(task)}><Pencil className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>שינוי משימה</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 relative" onClick={() => { setReplyingToTaskId(task.id); setReplyInputValue(""); }}><MessageCircle className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>הוסיפי תגובה</TooltipContent></Tooltip>
              {!task.done && (() => {
                const isAssignee = task.assignTo === currentUser?.email || task.assignTo === currentUser?.uid || task.assignTo === alias;
                const hasUnread = task.hasUnreadNudges === true;
                const shouldShowNudges = isAssignee && hasUnread;
                return (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className={`w-6 h-6 relative ${hasUnread ? 'text-orange-500' : 'text-gray-400'} hover:text-orange-600`} 
                        title={shouldShowNudges ? 'צפה בתזכורות' : 'שלח תזכורת'}
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          shouldShowNudges ? handleShowNudges(task) : handleNudgeTask(task.id); 
                        }} 
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <Bell className="h-4 w-4" />
                        {hasUnread && (<span className="absolute -top-1 -right-1 h-2 w-2 bg-orange-500 rounded-full" />)}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{shouldShowNudges ? 'צפה בתזכורות' : 'שלח תזכורת'}</TooltipContent>
                  </Tooltip>
                );
              })()}
            </div>
          </div>
        </div>

        {sortedReplies.length > 0 && (
          <div className="mt-2 border-t pt-2">
            <div className="text-xs font-medium text-gray-500 mb-1">תגובות:</div>
            {sortedReplies.map((reply, index) => (
              <div key={`${task.id}-reply-${index}`} className={`text-xs mb-1 ${!reply.isRead && reply.userId !== currentUser.uid ? 'font-bold' : ''}`}>
                <span className="font-bold">{reply.userAlias}:</span> {reply.text}
                <span className="text-gray-400 text-xs mr-2"> ({formatDateTime(reply.timestamp)})</span>
                {!reply.isRead && reply.userId !== currentUser.uid && (<span className="text-green-500 text-xs">(חדש)</span>)}
              </div>
            ))}
          </div>
        )}

        {!task.done && replyingToTaskId === task.id && (
          <div className="mt-2">
            <input type="text" placeholder="הוסיפי תגובה..." className="w-full text-sm border rounded p-1 rtl" autoFocus value={replyInputValue} onChange={e => setReplyInputValue(e.target.value)} onKeyDown={e => { if (e.key === ' ' || e.code === 'Space') { e.stopPropagation(); } if (e.key === 'Enter' && replyInputValue.trim()) { handleTaskReply(task.id, replyInputValue.trim()); setReplyInputValue(""); setReplyingToTaskId(null); } else if (e.key === 'Escape') { setReplyingToTaskId(null); setReplyInputValue(""); } }} onBlur={() => { setReplyingToTaskId(null); setReplyInputValue(""); }} />
          </div>
        )}

        {hasUnreadReplies && (
          <div className="mt-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => handleMarkReplyAsRead(task.id)}>סמן כנקרא</Button>
          </div>
        )}
      </div>
    );
  };

  // Filters/sorting and derived lists
  const sortedAndFilteredTasks = useMemo(() => {
    const lowerSearchTerm = taskSearchTerm.toLowerCase();
    let filtered = tasks.filter((task) => {
      if (currentUser?.isAdmin) return true;
      const isAssignedToMe = task.assignTo === currentUser?.email || task.assignTo === currentUser?.alias || task.assignTo === "עצמי" && task.creatorId === currentUser?.uid;
      const isCreatedByMe = task.creatorId === currentUser?.uid;
      if (!isAssignedToMe && !isCreatedByMe) return false;
      const assigneeMatch = taskFilter === "הכל" || (taskFilter === "שלי" && (task.assignTo === currentUser?.email || task.assignTo === currentUser?.alias)) || (taskFilter === "אחרים" && task.assignTo !== currentUser?.email && task.assignTo !== currentUser?.alias);
      const doneMatch = showDoneTasks || !task.done;
      const priorityMatch = taskPriorityFilter === 'all' || task.priority === taskPriorityFilter;
      // Normalize task category for comparison to handle legacy category names
      const normalizedTaskCategory = normalizeCategory(task.category);
      const categoryMatch = selectedTaskCategories.length === 0 || selectedTaskCategories.map(normalizeCategory).includes(normalizedTaskCategory);
      const searchTermMatch = !lowerSearchTerm || task.title.toLowerCase().includes(lowerSearchTerm) || (task.subtitle && task.subtitle.toLowerCase().includes(lowerSearchTerm));
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
        } catch { return 0; }
      });
    }
    return filtered;
  }, [tasks, taskFilter, showDoneTasks, userHasSortedTasks, isTMFullView, taskPriorityFilter, selectedTaskCategories, taskSearchTerm, currentUser]);

  // Calendar events bridge
  const taskEvents = useMemo(() => {
    return tasks.map((task) => {
      let dueDate = null;
      if (task.dueDate) {
        if (typeof task.dueDate.toDate === 'function') dueDate = task.dueDate.toDate();
        else if (typeof task.dueDate === 'string') dueDate = new Date(task.dueDate);
        else if (task.dueDate instanceof Date) dueDate = task.dueDate;
      }
      if (!dueDate || isNaN(dueDate.getTime())) return null;
      const start = dueDate; const end = new Date(start.getTime() + 15 * 60 * 1000);
      return { id: `task-${task.id}`, title: task.title, start, end, assignTo: task.assignTo, resource: { type: 'task', data: task }, isDone: task.done || false };
    }).filter(Boolean);
  }, [tasks]);

  useEffect(() => {
    if (onCalendarDataChange) onCalendarDataChange({ events: taskEvents, users: assignableUsersWithSelf, taskCategories });
  }, [taskEvents, assignableUsersWithSelf, taskCategories, onCalendarDataChange]);

  // Listen to window event to open a task from calendar
  useEffect(() => {
    function handleOpenTask(e) {
      if (e.detail && e.detail.taskId) {
        const t = tasks.find(tt => tt.id === e.detail.taskId);
        if (t) handleEditTask(t);
      }
    }
    window.addEventListener('open-task', handleOpenTask);
    return () => window.removeEventListener('open-task', handleOpenTask);
  }, [tasks, handleEditTask]);

  const activeTaskForOverlay = activeId && typeof activeId === 'string' && activeId.startsWith('task-') ? tasks.find(task => `task-${task.id}` === activeId) : null;

  // Calculate old archived tasks count (30+ days)
  const oldArchivedTasksCount = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return archivedTasks.filter(task => {
      const completedAt = task.completedAt?.toDate ? task.completedAt.toDate() : new Date(task.completedAt);
      return completedAt < thirtyDaysAgo;
    }).length;
  }, [archivedTasks]);

  return (
    <Card className="flex flex-col">
      <CardHeader className="space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <CardTitle className="text-xl font-bold">{'מנהל המשימות'}</CardTitle>
          {onToggleFixedTasks && (
            <div className="flex justify-center items-center flex-1">
              <Button 
                variant={fixedTasksVisible ? "default" : "outline"} 
                size="sm" 
                onClick={onToggleFixedTasks}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                {fixedTasksVisible ? '👁️ הסתר משימות קבועות' : '👁️ הצג משימות קבועות'}
              </Button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsTMFullView(!isTMFullView)} className="w-full sm:w-auto">{isTMFullView ? "תצוגה מוקטנת" : "תצוגה מלאה"}</Button>
            <Button size="xs" onClick={onToggleBlockOrder} className="w-full sm:w-auto">{'מיקום: '}{blockPosition}</Button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex flex-wrap gap-2">
              <Button variant={taskFilter === 'הכל' ? 'default' : 'outline'} size="sm" onClick={() => { markPrefsChanged(); setTaskFilter('הכל'); }}>{'הכל'}</Button>
              <Button variant={taskFilter === 'שלי' ? 'default' : 'outline'} size="sm" onClick={() => { markPrefsChanged(); setTaskFilter('שלי'); }}>{'שלי'}</Button>
              <Button variant={taskFilter === 'אחרים' ? 'default' : 'outline'} size="sm" onClick={() => { markPrefsChanged(); setTaskFilter('אחרים'); }}>{'אחרים'}</Button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <IOSSwitch checked={showDoneTasks} onChange={(e) => { markPrefsChanged(); setShowDoneTasks(e.target.checked); }} inputProps={{ 'aria-label': 'הצג בוצעו' }} />
                <Label className="text-sm font-medium cursor-pointer select-none">{'הצג בוצעו'}</Label>
              </div>
              <div className="flex items-center gap-2 mr-4 pr-4 border-r">
                <IOSSwitch checked={showOverdueEffects} onChange={(e) => { markPrefsChanged(); setShowOverdueEffects(e.target.checked); }} inputProps={{ 'aria-label': 'הצג חיווי איחור' }} />
                <Label className="text-sm font-medium cursor-pointer select-none">{'הצג חיווי איחור'}</Label>
              </div>
              {!isTMFullView && userHasSortedTasks && (
                <Button variant="ghost" size="icon" className="w-8 h-8" title="אפס סדר ידני" onClick={() => setUserHasSortedTasks(false)}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-t pt-3">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Select value={taskPriorityFilter} onValueChange={(val) => { markPrefsChanged(); setTaskPriorityFilter(val); }}>
                <SelectTrigger className="h-8 text-sm w-full sm:w-[100px]"><SelectValue placeholder="סינון עדיפות..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{'כל העדיפויות'}</SelectItem>
                  {taskPriorities.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-sm w-full sm:w-[140px] justify-between">
                    <span>{selectedTaskCategories.length === 0 ? "כל הקטגוריות" : selectedTaskCategories.length === 1 ? selectedTaskCategories[0] : `${selectedTaskCategories.length} נבחרו`}</span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[140px]">
                  <DropdownMenuLabel>{'סינון קטגוריה'}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {taskCategories.map((category) => (
                    <DropdownMenuCheckboxItem key={category} checked={selectedTaskCategories.includes(category)} onCheckedChange={() => { markPrefsChanged(); setSelectedTaskCategories(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]); }} onSelect={(e) => e.preventDefault()}>{category}</DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input type="search" placeholder="חפש משימות..." className="h-8 text-sm pl-8 w-full sm:w-[180px]" value={taskSearchTerm} onChange={(e) => { markPrefsChanged(); setTaskSearchTerm(e.target.value); }} />
              </div>
              <Button
                size="sm"
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
                onClick={() => {
                  setNewTaskTitle("");
                  setNewTaskSubtitle("");
                  setNewTaskPriority("רגיל");
                  setNewTaskCategory(taskCategories[0] || "");
                  setNewTaskDueDate("");
                  setNewTaskDueTime("");
                  const myUser = assignableUsersWithSelf.find(u => u.email === currentUser?.email || u.alias === currentUser?.alias);
                  setNewTaskAssignTo(myUser ? (myUser.alias || myUser.email) : (currentUser?.alias || currentUser?.email || ""));
                  setShowTaskModal(true);
                }}
              >
                {'+ משימה'}
              </Button>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button variant="outline" size="icon" className="w-8 h-8 text-red-600 hover:bg-red-50 hover:text-red-700" title="מחק משימות שבוצעו" onClick={handleClearDoneTasks} disabled={!tasks.some(task => task.done)}><span role="img" aria-label="Clear Done">🧹</span></Button>
              <Button variant="outline" size="sm" title="היסטוריית משימות" onClick={() => setShowHistoryModal(true)}><span role="img" aria-label="History">📜</span></Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        {isTMFullView ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
            <SortableContext items={taskCategories} strategy={horizontalListSortingStrategy}>
              <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-${Math.min(6, Math.max(1, taskCategories.length))} gap-3 overflow-x-auto`}>
                {taskCategories.map((category) => (
                  <SortableCategoryColumn key={category} id={category} className="bg-gray-100 rounded-lg p-2 flex flex-col min-w-[280px] box-border w-full min-w-0">
                    <div className="flex justify-between items-center mb-2 sticky top-0 bg-gray-100 py-1 px-1 z-10">
                      <Button variant="ghost" size="icon" className="w-6 h-6 text-gray-500 hover:text-blue-600 shrink-0 ml-2 rtl:ml-0 rtl:mr-2" title={kanbanCollapsed[category] ? 'הרחב קטגוריה' : 'צמצם קטגוריה'} onClick={() => handleToggleKanbanCollapse(category)} tabIndex={0} aria-label={kanbanCollapsed[category] ? 'הרחב קטגוריה' : 'צמצם קטגוריה'}>
                        {kanbanCollapsed[category] ? <ChevronLeft className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </Button>
                      <h3 className="font-semibold text-center flex-grow">{category} ({sortedAndFilteredTasks.filter(task => task.category === category).length})</h3>
                      <Button variant="ghost" size="icon" className="w-6 h-6 text-gray-500 hover:text-blue-600 shrink-0" title={`הוסיפי ל${category}`} onClick={() => { setNewTaskCategory(category); setShowTaskModal(true); }}><span role="img" aria-label="Add">➕</span></Button>
                    </div>
                    <div className="flex-1 w-full min-w-0 box-border" data-category={category} data-droppable="true">
                      <div className="space-y-2 w-full min-w-0 box-border">
                        {showTaskModal && newTaskCategory === category && renderTask(null)}
                        {sortedAndFilteredTasks.filter(task => task.category === category).map((task) => (
                          <SortableItem key={`task-${task.id}`} id={`task-${task.id}`}>
                            <div className="relative flex items-center group w-full min-w-0 box-border">
                              <Button variant="ghost" size="icon" className="w-6 h-6 text-gray-400 hover:text-blue-600 shrink-0 ml-2 rtl:ml-0 rtl:mr-2" title={kanbanTaskCollapsed[task.id] ? 'הרחב משימה' : 'צמצם משימה'} onClick={(e) => { e.stopPropagation(); handleToggleTaskCollapse(task.id); }} tabIndex={0} aria-label={kanbanTaskCollapsed[task.id] ? 'הרחב משימה' : 'צמצם משימה'}>
                                {kanbanTaskCollapsed[task.id] ? <ChevronLeft className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                              {kanbanCollapsed[category] || kanbanTaskCollapsed[task.id] ? (
                                <div className="flex-grow cursor-grab active:cursor-grabbing group w-full min-w-0 p-3 rounded-lg shadow-sm border bg-white flex items-center gap-2 min-h-[48px] box-border">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex-grow truncate text-right">
                                        <div className={`font-medium truncate ${task.done ? 'line-through text-gray-500' : ''}`}>{task.title}</div>
                                        {task.subtitle && (<div className={`text-xs text-gray-600 truncate ${task.done ? 'line-through' : ''}`}>{task.subtitle}</div>)}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" align="end" className="max-w-xs text-xs text-right whitespace-pre-line">
                                      {`🗓️ ${formatDateTime(task.dueDate)}\n👤 ${assignableUsersWithSelf.find(u => u.email === task.assignTo)?.alias || task.assignTo}\n${task.creatorAlias ? `📝 ${task.creatorAlias}\n` : ''}🏷️ ${task.category}\n${task.priority === 'דחוף' ? '🔥' : task.priority === 'נמוך' ? '⬇️' : '➖'} ${task.priority}`}
                                    </TooltipContent>
                                  </Tooltip>
                                  <div className="flex items-center gap-1">
                                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditTask(task)}><Pencil className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>שינוי משימה</TooltipContent></Tooltip>
                                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 relative" onClick={() => { setReplyingToTaskId(task.id); setReplyInputValue(""); }}><MessageCircle className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>הוסיפי תגובה</TooltipContent></Tooltip>
                                    {!task.done && (() => {
                                      const isAssignee = task.assignTo === currentUser?.email || task.assignTo === currentUser?.uid || task.assignTo === alias;
                                      const hasUnread = task.hasUnreadNudges === true;
                                      const shouldShowNudges = isAssignee && hasUnread;
                                      return (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button 
                                              variant="ghost" 
                                              size="icon" 
                                              className={`w-6 h-6 relative ${hasUnread ? 'text-orange-500' : 'text-gray-400'} hover:text-orange-600`}
                                              title={shouldShowNudges ? 'צפה בתזכורות' : 'שלח תזכורת'}
                                              onClick={(e) => { 
                                                e.stopPropagation(); 
                                                shouldShowNudges ? handleShowNudges(task) : handleNudgeTask(task.id); 
                                              }} 
                                              onPointerDown={(e) => e.stopPropagation()}
                                            >
                                              <Bell className="h-4 w-4" />
                                              {hasUnread && (<span className="absolute -top-1 -right-1 h-2 w-2 bg-orange-500 rounded-full" />)}
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>{shouldShowNudges ? 'צפה בתזכורות' : 'שלח תזכורת'}</TooltipContent>
                                        </Tooltip>
                                      );
                                    })()}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex-grow w-full min-w-0 box-border">{renderTask(task)}</div>
                              )}
                            </div>
                          </SortableItem>
                        ))}
                      </div>
                    </div>
                  </SortableCategoryColumn>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="pr-2">
            <div className="space-y-2 w-full">
              {showTaskModal && <div className="w-full">{renderTask(null)}</div>}
              {sortedAndFilteredTasks.length === 0 && !showTaskModal && (<div className="text-center text-gray-500 py-4 w-full">{'אין משימות להצגה'}</div>)}
              {sortedAndFilteredTasks.map((task) => (
                <SortableItem key={task.uniqueId} id={`task-${task.id}`}>
                  <div className={`w-full flex items-start justify-between p-2 cursor-grab active:cursor-grabbing ${task.done ? 'bg-gray-100 opacity-70' : ''}`}>
                    {renderTask(task)}
                  </div>
                </SortableItem>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      <DragOverlay dropAnimation={null}>
        {activeId && activeTaskForOverlay ? (
          <div className="p-2 border rounded shadow-xl bg-white opacity-90">
            <div className="flex items-start space-x-3 space-x-reverse">
              <Checkbox checked={!!activeTaskForOverlay.done} readOnly id={`drag-${activeTaskForOverlay.id}`} className="mt-1 shrink-0"/>
              <div className="flex-grow overflow-hidden">
                <label htmlFor={`drag-${activeTaskForOverlay.id}`} className={`font-medium text-sm cursor-grabbing ${activeTaskForOverlay.done ? "line-through text-gray-500" : "text-gray-900"}`}>{activeTaskForOverlay.title}</label>
                {activeTaskForOverlay.subtitle && (<p className={`text-xs mt-0.5 ${activeTaskForOverlay.done ? "line-through text-gray-400" : "text-gray-600"}`}>{activeTaskForOverlay.subtitle}</p>)}
                <div className="text-xs text-gray-500 mt-1 space-x-2 space-x-reverse">
                  <span>🗓️ {formatDateTime(activeTaskForOverlay.dueDate)}</span>
                  <span>👤 {assignableUsersWithSelf.find(u => u.email === activeTaskForOverlay.assignTo)?.alias || activeTaskForOverlay.assignTo}</span>
                  {activeTaskForOverlay.creatorAlias && <span className="font-medium">📝 {activeTaskForOverlay.creatorAlias}</span>}
                  <span>🏷️ {activeTaskForOverlay.category}</span>
                  <span>{activeTaskForOverlay.priority === 'דחוף' ? '🔥' : activeTaskForOverlay.priority === 'נמוך' ? '⬇️' : '➖'} {activeTaskForOverlay.priority}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>

      {showHistoryModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 p-4" onClick={() => setShowHistoryModal(false)}>
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 shrink-0 gap-2">
              <h2 className="text-lg font-semibold text-right">{'היסטוריית משימות שבוצעו'}</h2>
              <div className="flex items-center gap-2">
                {oldArchivedTasksCount > 0 && (
                  <span className="text-xs text-gray-600 bg-orange-100 px-2 py-1 rounded font-medium">
                    {oldArchivedTasksCount} ישנות
                  </span>
                )}
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={deleteOldArchivedTasks}
                  title={`מחק ${oldArchivedTasksCount} משימות ישנות (30+ יום)`}
                  className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700 border-red-300"
                  disabled={oldArchivedTasksCount === 0}
                >
                  {'🗑️'}
                </Button>
              </div>
            </div>
            <div className="overflow-y-auto flex-grow mb-4 border rounded p-2 bg-gray-50">
              <ul className="space-y-2">
                {archivedTasks
                  .sort((a, b) => {
                    const aTime = a.completedAt?.toDate ? a.completedAt.toDate().getTime() : new Date(a.completedAt).getTime();
                    const bTime = b.completedAt?.toDate ? b.completedAt.toDate().getTime() : new Date(b.completedAt).getTime();
                    return bTime - aTime;
                  })
                  .map(task => {
                    const createdAt = task.createdAt?.toDate ? task.createdAt.toDate() : new Date(task.createdAt);
                    const completedAt = task.completedAt?.toDate ? task.completedAt.toDate() : new Date(task.completedAt);
                    let duration = "";
                    if (completedAt && createdAt && !isNaN(completedAt.getTime()) && !isNaN(createdAt.getTime())) {
                      try {
                        const durationMs = completedAt.getTime() - createdAt.getTime();
                        duration = formatDuration(durationMs);
                      } catch { duration = "N/A"; }
                    }
                    let latestReply = null;
                    if (Array.isArray(task.replies) && task.replies.length > 0) {
                      latestReply = task.replies.reduce((latest, curr) => {
                        const currTime = curr.timestamp?.toDate ? curr.timestamp.toDate().getTime() : new Date(curr.timestamp).getTime();
                        const latestTime = latest ? (latest.timestamp?.toDate ? latest.timestamp.toDate().getTime() : new Date(latest.timestamp).getTime()) : 0;
                        return currTime > latestTime ? curr : latest;
                      }, null);
                    }
                    const completedBy = task.completedByAlias || task.completedBy || task.completedByEmail || 'לא ידוע';
                    return (
                      <li key={`hist-${task.id}`} className="p-2 border rounded bg-white text-sm text-right">
                        <div className="font-medium">{task.title}{task.subtitle ? ` - ${task.subtitle}` : ''}</div>
                        {latestReply && latestReply.text && (<div className="text-xs text-blue-700 mt-1 border-b pb-1">{latestReply.text}</div>)}
                        <div className="text-xs text-gray-600 mt-1">
                          {'בוצע על ידי '}<span className="font-semibold">{completedBy}</span>{' בתאריך '}<span className="font-semibold">{formatDateTime(completedAt)}</span>
                          {duration && <span className="ml-2 mr-2 pl-2 border-l">{'משך: '}<span className="font-semibold">{duration}</span></span>}
                        </div>
                        {(currentUser?.role === 'admin' || role === 'admin') && (
                          <Button variant="outline" size="sm" className="mt-2" onClick={() => restoreTask(task)}>{'שחזר משימה'}</Button>
                        )}
                      </li>
                    );
                  })}
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

      {showNudgesModal && selectedTaskForNudges && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 p-4" onClick={() => { setShowNudgesModal(false); setSelectedTaskForNudges(null); }}>
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h2 className="text-lg font-semibold text-right">{'תזכורות למשימה'}</h2>
            </div>
            <div className="mb-4">
              <div className="font-medium text-gray-800 mb-1">{selectedTaskForNudges.title}</div>
              {selectedTaskForNudges.subtitle && (
                <div className="text-sm text-gray-600">{selectedTaskForNudges.subtitle}</div>
              )}
            </div>
            <div className="overflow-y-auto flex-grow mb-4 border rounded p-3 bg-gray-50">
              {selectedTaskForNudges.nudges && selectedTaskForNudges.nudges.length > 0 ? (
                <ul className="space-y-3">
                  {selectedTaskForNudges.nudges
                    .slice()
                    .sort((a, b) => {
                      const aTime = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime();
                      const bTime = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime();
                      return bTime - aTime;
                    })
                    .map((nudge, index) => {
                      const timestamp = nudge.timestamp?.toDate ? nudge.timestamp.toDate() : new Date(nudge.timestamp);
                      return (
                        <li key={`nudge-${index}`} className="p-3 border rounded bg-white text-sm text-right">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-orange-600">🔔 {nudge.userAlias || 'משתמש לא ידוע'}</span>
                            <span className="text-xs text-gray-500">{formatDateTime(timestamp)}</span>
                          </div>
                          <div className="text-xs text-gray-600">
                            {'שלח/ה תזכורת על משימה זו'}
                          </div>
                        </li>
                      );
                    })}
                </ul>
              ) : (
                <div className="text-center text-gray-500 py-6">{'אין תזכורות למשימה זו'}</div>
              )}
            </div>
            <div className="mt-auto pt-4 border-t flex justify-end gap-2 shrink-0">
              <Button 
                variant="default" 
                onClick={() => handleDismissNudges(selectedTaskForNudges.id)}
                className="bg-green-600 hover:bg-green-700"
              >
                {'סמן כנקרא'}
              </Button>
              <Button variant="outline" onClick={() => { setShowNudgesModal(false); setSelectedTaskForNudges(null); }}>{'סגור'}</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}


