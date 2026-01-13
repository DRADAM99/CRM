import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, arrayUnion, setDoc, getDocs, getDoc, Timestamp } from "firebase/firestore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { FaWhatsapp, FaCodeBranch, FaFacebook, FaInstagram, FaSpotify, FaGlobe, FaUserFriends, FaEllipsisH } from "react-icons/fa";
import { Search, ChevronDown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/app/context/AuthContext";
import { useData } from "@/app/context/DataContext";

// --- Status config (copy from page.js) ---
const leadStatusConfig = {
  "נקבע יעוץ": { color: "bg-green-500", priority: 1 },
  "רשימת המתנה": { color: "bg-teal-400", priority: 1.5 },
  "הומלץ טיפול": { color: "bg-blue-500", priority: 2 },
  "לא הומלץ טיפול": { color: "bg-gray-400", priority: 3 },
  "ניתן מידע": { color: "bg-yellow-400", priority: 4 },
  "בבדיקת לקוח": { color: "bg-orange-600", priority: 4.5 },
  "הסדר תשלום": { color: "bg-purple-400", priority: 5 },
  "נקבעה סדרה": { color: "bg-emerald-400", priority: 6 },
  "לא מעוניינים": { color: "bg-gray-500", priority: 7 },
  "יעוץ בוטל": { color: "bg-red-400", priority: 8 },
  "ממשיכים לסדרה נוספת": { color: "bg-black", priority: 9 },
  Default: { color: "bg-gray-300", priority: 99 }
};
const leadColorTab = (status) => leadStatusConfig[status]?.color || leadStatusConfig.Default.color;

const candidatesStatuses = [
  "נקבע יעוץ",
  "רשימת המתנה",
  "הומלץ טיפול",
  "לא הומלץ טיפול",
  "ניתן מידע",
  "בבדיקת לקוח",
  "הסדר תשלום",
  "נקבעה סדרה",
  "לא מעוניינים",
  "יעוץ בוטל",
  "ממשיכים לסדרה נוספת"
];

// --- Branch options and pastel colors ---
const BRANCHES = [
  { value: '', label: 'ללא סניף', color: 'bg-gray-200 text-gray-700' },
  { value: 'רעננה', label: 'רעננה', color: 'bg-green-200 text-green-800' },
  { value: 'מודיעין', label: 'מודיעין', color: 'bg-blue-200 text-blue-800' },
  { value: 'עין-דור', label: 'עין-דור', color: 'bg-purple-200 text-purple-800' },
];
const branchColor = (branch) => {
  const found = BRANCHES.find(b => b.value === branch);
  return found ? found.color : 'bg-gray-200 text-gray-700';
};

// Source options and icons
const sourceOptions = ["אתר", "פייסבוק", "אינסטגרם", "פודקאסט", "המלצה", "אחר"];
const getSourceIcon = (source) => {
  switch(source) {
    case "אתר": return <FaGlobe className="w-4 h-4" />;
    case "פייסבוק": return <FaFacebook className="w-4 h-4" />;
    case "אינסטגרם": return <FaInstagram className="w-4 h-4" />;
    case "פודקאסט": return <FaSpotify className="w-4 h-4" />;
    case "המלצה": return <FaUserFriends className="w-4 h-4" />;
    case "אחר": return <FaEllipsisH className="w-4 h-4" />;
    default: return null;
  }
};

// Utility for date formatting (copy from page.js)
const formatDateTime = (date) => {
  if (!date) return "";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return `${d.toLocaleDateString("he-IL")} ${d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  } catch (error) { return ""; }
};

// Restore getPref/savePref helpers for local persistence
function savePref(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}
function getPref(key, def) {
  try { const v = localStorage.getItem(key); if (v !== null) return JSON.parse(v); } catch (e) {} return def; }

export default function CandidatesBlock({ isFullView: parentIsFullView, setIsFullView: parentSetIsFullView }) {
  const { currentUser } = useAuth();
  const { leads, assignableUsers, currentUserData } = useData();
  // --- State ---
  // Multi-select status filter - now from Firestore for cross-device persistence
  const [selectedStatuses, setSelectedStatuses] = useState(candidatesStatuses);
  const [searchTerm, setSearchTerm] = useState("");
  const [blockOrder, setBlockOrder] = useState(() => getPref('candidates_blockOrder', 4));
  const [sortBy, setSortBy] = useState("priority");
  const [sortDirection, setSortDirection] = useState("desc");
  const [rowLimit, setRowLimit] = useState(50);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [persistenceReady, setPersistenceReady] = useState(false);
  const savedSelectedRef = useRef(null);
  const hasLoadedFromFirestore = useRef(false);
  const [editingLeadId, setEditingLeadId] = useState(null);
  const [editLeadFullName, setEditLeadFullName] = useState("");
  const [editLeadPhone, setEditLeadPhone] = useState("");
  const [editLeadMessage, setEditLeadMessage] = useState("");
  const [editLeadStatus, setEditLeadStatus] = useState("");
  const [editLeadSource, setEditLeadSource] = useState("");
  const [editLeadBranch, setEditLeadBranch] = useState("");
  // Conversation update state
  const [showConvUpdate, setShowConvUpdate] = useState(null);
  const [newConversationText, setNewConversationText] = useState("");
  const [holdLeadId, setHoldLeadId] = useState(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdAnimationRef = useRef();
  const holdDelayTimeout = useRef();
  const HOLD_DURATION = 1500;
  // Add state for new task creation:
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskAssignTo, setNewTaskAssignTo] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState("להתקשר");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskDueTime, setNewTaskDueTime] = useState("");
  // Add state for task categories (assignableUsers now from DataContext)
  const [taskCategories, setTaskCategories] = useState(["להתקשר", "לקבוע סדרה", "דוחות", "תשלומים וזיכויים", "תוכניות טיפול", "אחר"]);
  // Add state for full width toggle
  const [isFullWidth, setIsFullWidth] = useState(() => getPref('candidates_isFullWidth', false));
  const [userHasExplicitlyChangedPrefs, setUserHasExplicitlyChangedPrefs] = useState(false);
  // Add Lead Modal state
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [newLeadFullName, setNewLeadFullName] = useState("");
  const [newLeadPhone, setNewLeadPhone] = useState("");
  const [newLeadMessage, setNewLeadMessage] = useState("");
  const [newLeadStatus, setNewLeadStatus] = useState("חדש");
  const [newLeadSource, setNewLeadSource] = useState("");
  const [newLeadIsHot, setNewLeadIsHot] = useState(false);
  const [newLeadSourceOther, setNewLeadSourceOther] = useState("");

  // Ensure current user is always in the assignable users list
  const assignableUsersWithSelf = useMemo(() => {
    if (!currentUser) return assignableUsers;
    const isCurrentUserInList = assignableUsers.some(
      u => u.id === currentUser.uid || u.email === currentUser.email
    );
    if (isCurrentUserInList) return assignableUsers;
    const role = currentUserData?.role || "staff";
    const alias = currentUserData?.alias || currentUser.email;
    return [{
      id: currentUser.uid,
      email: currentUser.email,
      alias: alias,
      role: role
    }, ...assignableUsers];
  }, [assignableUsers, currentUser, currentUserData]);

  // Helper to mark that user has explicitly changed preferences
  const markPrefsChanged = useCallback(() => {
    console.log('🔔 CandidatesBlock: User explicitly changed preferences - enabling persistence');
    setUserHasExplicitlyChangedPrefs(true);
    setPersistenceReady(true); // Enable persistence now that user has made a change
  }, []);

  // Load persisted preferences from Firestore
  useEffect(() => {
    if (!currentUser) {
      console.log('📥 CandidatesBlock: No currentUser, skipping load');
      return;
    }
    console.log('📥 CandidatesBlock: Starting to load preferences for user:', currentUser.uid);
    const loadPrefs = async () => {
      try {
        // Small delay to ensure Firebase is fully initialized
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const userRef = doc(db, 'users', currentUser.uid);
        console.log('🔍 CandidatesBlock: Fetching user document for UID:', currentUser.uid);
        const snap = await getDoc(userRef);
        console.log('🔍 CandidatesBlock: Got snapshot, exists:', snap.exists(), 'fromCache:', snap.metadata.fromCache);
        
        if (snap.exists()) {
          hasLoadedFromFirestore.current = true;
          const d = snap.data();
          console.log('📥 CandidatesBlock: User document exists:', {
            candidates_selectedStatuses: d.candidates_selectedStatuses,
            hasField: 'candidates_selectedStatuses' in d,
            isArray: Array.isArray(d.candidates_selectedStatuses)
          });
          if (d.candidates_sortBy) setSortBy(d.candidates_sortBy);
          if (d.candidates_sortDirection) setSortDirection(d.candidates_sortDirection);
          if (typeof d.candidates_searchTerm === 'string') setSearchTerm(d.candidates_searchTerm);
          if (typeof d.candidates_rowLimit === 'number') setRowLimit(d.candidates_rowLimit);
          
          // Handle status selection properly - check if field exists explicitly
          if ('candidates_selectedStatuses' in d && Array.isArray(d.candidates_selectedStatuses)) {
            console.log('✅ CandidatesBlock: Setting statuses from Firestore:', d.candidates_selectedStatuses);
            savedSelectedRef.current = d.candidates_selectedStatuses;
            setSelectedStatuses(d.candidates_selectedStatuses);
          } else {
            // Only default to all statuses if never saved before
            console.log('⚠️ CandidatesBlock: No saved statuses, defaulting to all');
            savedSelectedRef.current = candidatesStatuses;
            setSelectedStatuses(candidatesStatuses);
          }
        } else {
          // No user document exists, default to all statuses
          hasLoadedFromFirestore.current = false; // NOT loaded from Firestore
          console.log('⚠️ CandidatesBlock: No user document exists yet, defaulting to all');
          console.log('⚠️ CandidatesBlock: Will NOT auto-save defaults - waiting for explicit user changes');
          savedSelectedRef.current = candidatesStatuses;
          setSelectedStatuses(candidatesStatuses);
          // Don't enable persistence for defaults - only when user explicitly changes something
        }
        console.log('✅ CandidatesBlock: Setting prefsLoaded=true');
        setPrefsLoaded(true);
      } catch (err) {
        console.error('❌ CandidatesBlock: Error loading candidates prefs:', err);
        // On error, default to all statuses
        savedSelectedRef.current = candidatesStatuses;
        setSelectedStatuses(candidatesStatuses);
        setPrefsLoaded(true);
      }
    };
    loadPrefs();
  }, [currentUser]);

  // Set persistenceReady in a separate effect after prefsLoaded is true
  // This ensures proper timing and prevents race conditions
  useEffect(() => {
    if (prefsLoaded && hasLoadedFromFirestore.current) {
      console.log('✅ CandidatesBlock: Setting persistenceReady=true (after prefs loaded)');
      setPersistenceReady(true);
    }
  }, [prefsLoaded]);

  // Persist preferences to Firestore
  useEffect(() => {
    if (!currentUser || !prefsLoaded) {
      console.log('💾 CandidatesBlock: Skipping persistence:', { currentUser: !!currentUser, prefsLoaded, persistenceReady, userHasExplicitlyChangedPrefs });
      return;
    }
    
    // Only persist if:
    // 1. We successfully loaded existing preferences (persistenceReady), OR
    // 2. User has explicitly changed something (userHasExplicitlyChangedPrefs)
    if (!persistenceReady && !userHasExplicitlyChangedPrefs) {
      console.log('💾 CandidatesBlock: Skipping persistence - no existing prefs loaded and no explicit changes yet');
      return;
    }
    
    // Only persist if we've successfully loaded preferences from Firestore OR user has explicitly changed something
    // This prevents persisting defaults before we've tried to load
    if (!hasLoadedFromFirestore.current && !userHasExplicitlyChangedPrefs) {
      console.log('💾 CandidatesBlock: Skipping persistence - waiting for Firestore load');
      return;
    }
    
    console.log('💾 CandidatesBlock: Persisting preferences:', {
      selectedStatuses,
      sortBy,
      sortDirection,
      searchTerm,
      rowLimit,
      uid: currentUser.uid
    });
    
    // Update the ref to keep it in sync with current selection
    savedSelectedRef.current = selectedStatuses;
    const userRef = doc(db, 'users', currentUser.uid);
    
    const dataToSave = {
      candidates_sortBy: sortBy,
      candidates_sortDirection: sortDirection,
      candidates_searchTerm: searchTerm,
      candidates_selectedStatuses: selectedStatuses,
      candidates_rowLimit: rowLimit,
      updatedAt: serverTimestamp(),
    };
    
    console.log('💾 CandidatesBlock: Data to save:', dataToSave);
    
    setDoc(userRef, dataToSave, { merge: true })
      .then(() => {
        console.log('✅ CandidatesBlock: Successfully wrote to Firestore!');
        console.log('✅ CandidatesBlock: Saved data:', dataToSave);
        // Once we've saved once, enable persistence for future changes
        if (!persistenceReady) {
          setPersistenceReady(true);
        }
      })
      .catch((err) => {
        console.error('❌ CandidatesBlock: Error persisting candidates prefs:', err);
        console.error('❌ CandidatesBlock: Failed to save:', dataToSave);
      });
  }, [currentUser, prefsLoaded, persistenceReady, userHasExplicitlyChangedPrefs, sortBy, sortDirection, searchTerm, selectedStatuses, rowLimit]);

  // Persist full width preference to localStorage (less critical, can stay local)
  useEffect(() => {
    savePref('candidates_isFullWidth', isFullWidth);
  }, [isFullWidth]);

  // Leads and users now come from DataContext

  // --- Sorting logic ---
  const compareLeads = (a, b) => {
    if (sortBy === "priority") {
      const priorityDiff = (leadStatusConfig[a.status]?.priority || 99) - (leadStatusConfig[b.status]?.priority || 99);
      if (priorityDiff !== 0) return sortDirection === "asc" ? priorityDiff : -priorityDiff;
      // fallback to date
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      return sortDirection === "asc" ? dateA - dateB : dateB - dateA;
    } else {
      // sortBy === "date"
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      return sortDirection === "asc" ? dateA - dateB : dateB - dateA;
    }
  };

  // --- Filtered and sorted candidates ---
  const filteredCandidates = useMemo(() => {
    return leads
      .filter(lead => selectedStatuses.includes(lead.status))
      .filter(lead => {
        const term = searchTerm.toLowerCase();
        return (
          !term ||
          lead.fullName?.toLowerCase().includes(term) ||
          lead.phoneNumber?.includes(term) ||
          lead.message?.toLowerCase().includes(term) ||
          lead.status?.toLowerCase().includes(term)
        );
      })
      .sort(compareLeads);
  }, [leads, selectedStatuses, searchTerm, sortBy, sortDirection]);

  // --- Actions ---
  const handleDuplicateLead = async (lead) => {
    try {
      const duplicatedLead = {
        ...lead,
        fullName: lead.fullName + " משוכפל",
        createdAt: new Date(),
      };
      delete duplicatedLead.id;
      await addDoc(collection(db, "leads"), duplicatedLead);
      alert("הליד שוכפל");
    } catch (error) {
      alert("שגיאה בשכפול ליד");
    }
  };

  // --- Click2Call cloud PBX logic ---
  const handleClick2Call = async (phoneNumber) => {
    const userExt = currentUserData?.EXT || "";
    if (!userExt) { 
      alert("לא הוגדרה שלוחה (EXT) למשתמש זה. פנה למנהל המערכת."); 
      return; 
    }
    const apiUrl = "/api/click2call";
    const payload = {
      phone_number: phoneNumber,
      extension_number: String(userExt)
    };
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        alert(`שיחה ל-${phoneNumber} הופעלה דרך המרכזיה.`);
      } else {
        const errorText = await response.text();
        alert(errorText || "לא ניתן היה להפעיל שיחה דרך המרכזיה.");
      }
    } catch (error) {
      alert(error.message || "לא ניתן היה להפעיל שיחה דרך המרכזיה.");
    }
  };

  // --- Edit logic ---
  const handleEditLead = (lead) => {
    setEditingLeadId(lead.id);
    setEditLeadFullName(lead.fullName);
    setEditLeadPhone(lead.phoneNumber);
    setEditLeadMessage(lead.message);
    setEditLeadStatus(lead.status);
    setEditLeadSource(lead.source || "");
    setEditLeadBranch(lead.branch || "");
  };
  const handleSaveLead = async (e, leadId) => {
    e.preventDefault();
    console.log('Saving lead', leadId, editLeadFullName, editLeadPhone);
    setEditingLeadId(null); // Optimistically close the form
    try {
      const leadRef = doc(db, "leads", leadId);
      const leadToUpdate = leads.find(l => l.id === leadId);
      const isStatusChanging = leadToUpdate && leadToUpdate.status !== editLeadStatus;

      console.log("--- Auto-Task-Creation-Debug ---", {
        isStatusChanging: isStatusChanging,
        leadCurrentStatus: leadToUpdate ? leadToUpdate.status : "not found",
        newStatus: editLeadStatus,
        targetStatus: "נקבעה סדרה",
        isMatch: editLeadStatus === "נקבעה סדרה"
      });

      await updateDoc(leadRef, {
        fullName: editLeadFullName,
        phoneNumber: editLeadPhone,
        message: editLeadMessage,
        status: editLeadStatus,
        source: editLeadSource,
        branch: editLeadBranch,
        updatedAt: serverTimestamp(),
        ...(isStatusChanging && { isHot: false }),
      });

      if (isStatusChanging && editLeadStatus === "נקבעה סדרה" && currentUser) {
        const updatedLead = {
          id: leadId,
          fullName: editLeadFullName,
          branch: editLeadBranch,
        };
        await createAutomatedTaskForTreatmentPlan(updatedLead, currentUser);
      }

      setEditLeadBranch("");
    } catch (error) {
      alert("שגיאה בשמירת הליד");
      setEditingLeadId(leadId); // Reopen the form if there was an error
    }
  };
  const handleCancelEdit = () => {
    setEditingLeadId(null);
  };

  // --- Location button logic ---
  const handleToggleBlockOrder = () => {
    // Cycle between 1, 2, 3, 4 (for test/demo)
    setBlockOrder((prev) => (prev === 4 ? 1 : prev + 1));
  };

  // --- Conversation update logic ---
  const handleAddConversation = async (leadId) => {
    if (!newConversationText.trim()) return;
    try {
      const leadRef = doc(db, "leads", leadId);
      const newEntry = {
        text: newConversationText,
        timestamp: Timestamp.fromDate(new Date()),
      };
      await updateDoc(leadRef, {
        conversationSummary: arrayUnion(newEntry),
        updatedAt: serverTimestamp(),
      });
      setNewConversationText("");
      setShowConvUpdate(leadId); // keep open
    } catch (error) {
      alert("שגיאה בהוספת עדכון שיחה");
    }
  };

  // --- Follow-up counter logic ---
  const handleIncrementFollowUp = async (leadId, currentCount) => {
    try {
      const leadRef = doc(db, "leads", leadId);
      await updateDoc(leadRef, {
        followUpCall: {
          active: true,
          count: (currentCount || 0) + 1,
        },
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      alert("שגיאה בעדכון ספירת מעקב");
    }
  };

  // --- Follow-up button logic ---
  const handleFollowUpClick = async (lead) => {
    if (holdLeadId === lead.id) return;
    if (!lead.followUpCall?.active && (!lead.followUpCall || lead.followUpCall.count === 0)) {
      const leadRef = doc(db, 'leads', lead.id);
      await updateDoc(leadRef, { followUpCall: { active: true, count: 1 } });
    } else if (lead.followUpCall?.active) {
      const leadRef = doc(db, 'leads', lead.id);
      await updateDoc(leadRef, { followUpCall: { active: true, count: (lead.followUpCall.count || 1) + 1 } });
    }
  };
  const handleFollowUpReset = async (lead) => {
    const leadRef = doc(db, 'leads', lead.id);
    await updateDoc(leadRef, { followUpCall: { active: false, count: 0 } });
    setTimeout(() => {
      setHoldLeadId(null);
      setHoldProgress(0);
    }, 50);
  };
  const handleHoldStart = (lead) => {
    setHoldLeadId(lead.id);
    setHoldProgress(0);
    holdDelayTimeout.current = setTimeout(() => {
      const start = Date.now();
      function animate() {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / 1200, 1);
        setHoldProgress(progress);
        if (progress < 1) {
          holdAnimationRef.current = requestAnimationFrame(animate);
        } else {
          handleFollowUpReset(lead);
        }
      }
      holdAnimationRef.current = requestAnimationFrame(animate);
    }, 300);
  };
  const handleHoldEnd = () => {
    setHoldLeadId(null);
    setHoldProgress(0);
    if (holdDelayTimeout.current) clearTimeout(holdDelayTimeout.current);
    if (holdAnimationRef.current) cancelAnimationFrame(holdAnimationRef.current);
  };

  // --- Add handler for creating a task from a lead:
  const handleCreateTaskFromLead = async (lead) => {
    if (!newTaskText.trim() || !newTaskAssignTo || !newTaskCategory || !newTaskDueDate) return;
    try {
      const assignedUser = assignableUsers.find(u => u.alias === newTaskAssignTo || u.email === newTaskAssignTo);
      const taskRef = doc(collection(db, "tasks"));
      await setDoc(taskRef, {
        id: taskRef.id,
        userId: lead.id, // or current user if available
        creatorId: lead.id, // or current user if available
        title: lead.fullName,
        subtitle: `${newTaskText} | טלפון: ${lead.phoneNumber}`,
        assignTo: assignedUser ? assignedUser.email : newTaskAssignTo,
        category: newTaskCategory,
        status: "פתוח",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        dueDate: newTaskDueDate && newTaskDueTime
          ? new Date(`${newTaskDueDate}T${newTaskDueTime}`).toISOString()
          : new Date(newTaskDueDate).toISOString(),
        replies: [],
        isRead: false,
        isArchived: false,
        done: false,
        completedBy: null,
        completedAt: null
      });
      setNewTaskText("");
      setNewTaskAssignTo("");
      setNewTaskCategory("להתקשר");
      setNewTaskDueDate("");
      setNewTaskDueTime("");
      alert("המשימה נוצרה בהצלחה");
    } catch (error) {
      alert("שגיאה ביצירת משימה");
    }
  };

  // --- Automated task creation for treatment plan ---
  const createAutomatedTaskForTreatmentPlan = async (lead, user) => {
    if (!user) {
      console.error("Cannot create automated task without a user.");
      return;
    }
    try {
      const taskRef = doc(collection(db, "tasks"));
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);

      const newTask = {
        id: taskRef.id,
        userId: lead.id,
        creatorId: user.uid,
        title: lead.fullName,
        subtitle: `נוצר מליד: ${lead.fullName} | טלפון: ${lead.phoneNumber}`,
        assignTo: "dradamwinter@gmail.com",
        category: "תוכניות טיפול",
        status: "פתוח",
        priority: "רגיל",
        branch: lead.branch || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        dueDate: dueDate.toISOString(),
        replies: [],
        isRead: false,
        isArchived: false,
        done: false,
        completedBy: null,
        completedAt: null,
      };

      console.log("Creating automated task with data:", newTask);
      await setDoc(taskRef, newTask);
      
      console.log(`Automated task created for lead: ${lead.fullName}`);
    } catch (error) {
      console.error("Error creating automated task:", error);
      alert("שגיאה ביצירת משימה אוטומטית");
    }
  };

  // --- Add new lead handler ---
  const handleAddNewLead = async (e) => {
    e.preventDefault();
    if (!newLeadFullName.trim() || !newLeadPhone.trim()) {
      alert("אנא מלא שם מלא ומספר טלפון.");
      return;
    }
    try {
      const finalSource = newLeadSource === "אחר" ? newLeadSourceOther.trim() : newLeadSource;
      await addDoc(collection(db, "leads"), {
        createdAt: serverTimestamp(),
        fullName: newLeadFullName.trim(),
        phoneNumber: newLeadPhone.trim(),
        message: newLeadMessage.trim(),
        status: newLeadStatus,
        source: finalSource,
        conversationSummary: [],
        isHot: newLeadIsHot,
        followUpCall: { active: false, count: 0 }
      });
      setNewLeadFullName("");
      setNewLeadPhone("");
      setNewLeadMessage("");
      setNewLeadStatus("חדש");
      setNewLeadSource("");
      setNewLeadSourceOther("");
      setNewLeadIsHot(false);
      setShowAddLeadModal(false);
    } catch (error) {
      alert("שגיאה בהוספת ליד חדש. נסה שוב.");
    }
  };

  // --- UI ---
  return (
    <div
      style={{ order: blockOrder }}
      className={`col-span-1 ${parentIsFullView ? (isFullWidth ? 'lg:col-span-12' : 'lg:col-span-8') : (isFullWidth ? 'lg:col-span-12' : 'lg:col-span-4')} transition-all duration-300 ease-in-out`}
    >
      <Card className="h-full flex flex-col">
        <CardHeader>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <CardTitle className="text-xl font-bold">{'מועמדים לתוכניות טיפול'}</CardTitle>
                <Button size="sm" onClick={() => setShowAddLeadModal(true)} className="bg-green-600 hover:bg-green-700 text-white">
                  {'+ הוסיפי מטופל'}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => parentSetIsFullView(v => !v)} variant="outline">
                  {parentIsFullView ? 'תצוגה מקוצרת' : 'תצוגה מלאה'}
                </Button>
                <Button size="sm" onClick={() => setIsFullWidth(v => !v)} variant="outline">
                  {isFullWidth ? '66% רוחב' : '100% רוחב'}
                </Button>
                <Button size="xs" onClick={handleToggleBlockOrder} variant="outline">
                  {'מיקום: '}{blockOrder}
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2 mt-2 border-t pt-2">
              <Select value={String(rowLimit)} onValueChange={(val) => { markPrefsChanged(); setRowLimit(Number(val)); }}>
                <SelectTrigger className="h-8 text-sm w-[80px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="30">30</SelectItem>
                  <SelectItem value="40">40</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="60">60</SelectItem>
                  <SelectItem value="70">70</SelectItem>
                  <SelectItem value="80">80</SelectItem>
                  <SelectItem value="90">90</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="150">150</SelectItem>
                </SelectContent>
              </Select>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-sm w-[180px] justify-between">
                    <span className="truncate">
                      {selectedStatuses.length === candidatesStatuses.length
                        ? "כל הסטטוסים"
                        : selectedStatuses.length === 1
                          ? candidatesStatuses.find(cat => cat === selectedStatuses[0])
                          : `${selectedStatuses.length} נבחרו`}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[180px]" dir="rtl">
                  <DropdownMenuLabel>{'סינון סטטוס'}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {candidatesStatuses.map((status) => (
                    <DropdownMenuCheckboxItem
                      key={status}
                      checked={selectedStatuses.includes(status)}
                      onCheckedChange={() => { markPrefsChanged(); setSelectedStatuses(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]); }}
                      onSelect={e => e.preventDefault()}
                      className="flex flex-row-reverse items-center justify-between"
                    >
                      <span className={`inline-block w-4 h-4 rounded mr-2 ${leadStatusConfig[status].color}`}></span>
                      {status}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-sm px-3"
                onClick={() => { markPrefsChanged(); setSelectedStatuses(candidatesStatuses); }}
              >
                כולם
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-sm px-3"
                onClick={() => { markPrefsChanged(); setSelectedStatuses(["הומלץ טיפול", "רשימת המתנה", "ניתן מידע", "הסדר תשלום", "ממשיכים לסדרה נוספת"]); }}
              >
                ראשי
              </Button>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  type="search"
                  placeholder="חפש מועמד..."
                  className="h-8 text-sm pl-8 w-[180px]"
                  value={searchTerm}
                  onChange={e => { markPrefsChanged(); setSearchTerm(e.target.value); }}
                />
              </div>
              <Select value={sortBy} onValueChange={(val) => { markPrefsChanged(); setSortBy(val); }}>
                <SelectTrigger className="h-8 text-sm w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="priority">עדיפות</SelectItem>
                  <SelectItem value="date">תאריך יצירה</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-sm w-[40px] px-2"
                onClick={() => { markPrefsChanged(); setSortDirection(dir => dir === 'asc' ? 'desc' : 'asc'); }}
                title={sortDirection === 'asc' ? 'סדר עולה' : 'סדר יורד'}
              >
                {sortDirection === 'asc' ? '⬆️' : '⬇️'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col overflow-hidden">
          {parentIsFullView ? (
            // --- Expanded Table View ---
            <div className="flex-grow overflow-auto">
              <table className="w-full table-fixed text-sm border-collapse min-w-[600px]">
                <thead className="sticky top-0 bg-gray-100 z-10">
                  <tr>
                    <th className="px-2 py-2 text-right font-semibold w-16">{'עדיפות'}</th>
                    <th className="px-2 py-2 text-right font-semibold w-32">{'תאריך'}</th>
                    <th className="px-2 py-2 text-right font-semibold w-32">{'שם מלא'}</th>
                    {isFullWidth && <th className="px-2 py-2 text-right font-semibold w-28">{'טלפון'}</th>}
                    <th className="px-2 py-2 text-right font-semibold w-24">{'סטטוס'}</th>
                    <th className="px-2 py-2 text-right font-semibold max-w-xs truncate">{'הודעה'}</th>
                    <th className="px-2 py-2 text-right font-semibold w-20">{'פעולות'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.slice(0, rowLimit).map(lead => {
                    const colorTab = leadColorTab(lead.status);
                    return (
                      <React.Fragment key={lead.id}>
                        <tr className="border-b hover:bg-gray-50 group">
                          <td className="px-2 py-2 align-top"><div className={`w-3 h-6 ${colorTab} rounded mx-auto`} /></td>
                          <td className="px-2 py-2 align-top whitespace-nowrap">{formatDateTime(lead.createdAt)}</td>
                          <td className="px-2 py-2 align-top font-medium">
                            {lead.isHot && <span className="mr-1">🔥</span>}
                            {lead.fullName}
                          </td>
                          {isFullWidth && <td className="px-2 py-2 align-top whitespace-nowrap">{lead.phoneNumber}</td>}
                          <td className="px-2 py-2 align-top">{lead.status}</td>
                          <td className="px-2 py-2 align-top truncate" title={lead.message}>{lead.message}</td>
                          <td className="px-2 py-2 align-top text-center">
                            <button
                              className="relative group"
                              style={{ outline: 'none', border: 'none', background: 'none', cursor: 'pointer' }}
                              onClick={() => handleFollowUpClick(lead)}
                              onMouseDown={() => handleHoldStart(lead)}
                              onMouseUp={handleHoldEnd}
                              onMouseLeave={handleHoldEnd}
                              tabIndex={0}
                              aria-label="סמן פולואפ טלפון"
                            >
                              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                                <circle
                                  cx="14" cy="14" r="13"
                                  stroke={lead.followUpCall?.active ? '#22c55e' : '#e5e7eb'}
                                  strokeWidth="2"
                                  fill={lead.followUpCall?.active ? '#22c55e' : 'white'}
                                />
                                <circle
                                  cx="14" cy="14" r="13"
                                  stroke="#22c55e"
                                  strokeWidth="3"
                                  fill="none"
                                  strokeDasharray={2 * Math.PI * 13}
                                  strokeDashoffset={(1 - (holdLeadId === lead.id ? holdProgress : 0)) * 2 * Math.PI * 13}
                                  style={{ transition: 'stroke-dashoffset 0.1s linear' }}
                                />
                                <path d="M19.5 17.5c-1.5 0-3-.5-4.5-2s-2-3-2-4.5c0-.5.5-1 1-1h2c.5 0 1 .5 1 1 0 .5.5 1 1 1s1-.5 1-1c0-2-1.5-3.5-3.5-3.5S9.5 9.5 9.5 11.5c0 4.5 3.5 8 8 8 .5 0 1-.5 1-1v-2c0-.5-.5-1-1-1z" fill={lead.followUpCall?.active ? 'white' : '#a3a3a3'} />
                              </svg>
                              {lead.followUpCall?.active && lead.followUpCall?.count > 1 && (
                                <span className="absolute -top-1 -right-1 bg-green-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center border-2 border-white">{lead.followUpCall.count}</span>
                              )}
                            </button>
                          </td>
                          <td className="px-2 py-2 align-top">
                            <div className="flex items-center gap-1">
                              <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="w-6 h-6 text-gray-500 hover:text-blue-600" title="פתח לעריכה" onClick={() => handleEditLead(lead)}><span role="img" aria-label="Edit" className="w-3 h-3">✎</span></Button></TooltipTrigger><TooltipContent>{'פתח/ערוך ליד'}</TooltipContent></Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <a href={`https://wa.me/${lead.phoneNumber}`} target="_blank" rel="noopener noreferrer">
                                    <Button size="icon" variant="ghost" className="w-6 h-6 text-green-600 hover:text-green-700">
                                      <FaWhatsapp className="w-3 h-3" />
                                    </Button>
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent>{'שלח וואטסאפ'}</TooltipContent>
                              </Tooltip>
                              <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="w-6 h-6 text-blue-600 hover:text-blue-700" onClick={() => handleClick2Call(lead.phoneNumber)}><span role="img" aria-label="Call" className="w-3 h-3">📞</span></Button></TooltipTrigger><TooltipContent>{'התקשר דרך המרכזיה'}</TooltipContent></Tooltip>
                            </div>
                          </td>
                        </tr>
                        {editingLeadId === lead.id && (
                          <tr className="border-b bg-blue-50">
                            <td colSpan={isFullWidth ? 8 : 7} className="p-4">
                              <form onSubmit={e => handleSaveLead(e, lead.id)} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  <Label className="block"><span className="text-gray-700 text-sm font-medium">{'שם מלא:'}</span><Input type="text" className="mt-1 h-8 text-sm" value={editLeadFullName} onChange={ev => setEditLeadFullName(ev.target.value)} required /></Label>
                                  <Label className="block"><span className="text-gray-700 text-sm font-medium">{'טלפון:'}</span><Input type="tel" className="mt-1 h-8 text-sm" value={editLeadPhone} onChange={ev => setEditLeadPhone(ev.target.value)} required /></Label>
                                  <Textarea rows={4} className="mt-1 text-sm resize-y" value={editLeadMessage} onChange={ev => setEditLeadMessage(ev.target.value)} />
                                  <Label className="block"><span className="text-gray-700 text-sm font-medium">{'סטטוס:'}</span>
                                    <Select value={editLeadStatus} onValueChange={setEditLeadStatus}>
                                      <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="בחר..." /></SelectTrigger>
                                      <SelectContent className="text-right" dir="rtl">
                                        {candidatesStatuses.map(status => (
                                          <SelectItem key={status} value={status} className="flex items-center gap-3 pl-2 text-right" showDefaultCheck={false}>
                                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded ${leadStatusConfig[status].color} ml-2`}>
                                              {editLeadStatus === status && (
                                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 20 20">
                                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 10l3 3 5-5" />
                                                </svg>
                                              )}
                                            </span>
                                            <span>{status}</span>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </Label>
                                  <Label className="block"><span className="text-gray-700 text-sm font-medium">{'מקור:'}</span><Input type="text" className="mt-1 h-8 text-sm" value={editLeadSource} onChange={ev => setEditLeadSource(ev.target.value)} /></Label>
                                  <Label className="block"><span className="text-gray-700 text-sm font-medium">סניף:</span>
                                    <Select value={editLeadBranch} onValueChange={setEditLeadBranch}>
                                      <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="בחר סניף..." /></SelectTrigger>
                                      <SelectContent className="text-right" dir="rtl">
                                        {BRANCHES.filter(b => b.value).map(b => (
                                          <SelectItem key={b.value} value={b.value}>
                                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${b.color}`}>{b.label}</span>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </Label>
                                </div>
                                <div className="border-t pt-3">
                                  <div className="flex justify-between items-center mb-2">
                                    <div className="font-semibold text-sm">{'היסטוריית שיחה:'}</div>
                                    <Button type="button" variant="link" size="sm" onClick={() => setShowConvUpdate(showConvUpdate === lead.id ? null : lead.id)} className="text-blue-600 hover:underline p-0 h-auto">{showConvUpdate === lead.id ? 'הסתר הוספה' : '+ הוסף עדכון'}</Button>
                                  </div>
                                  {showConvUpdate === lead.id && (
                                    <div className="flex gap-2 mb-3">
                                      <Textarea className="text-sm" rows={2} value={newConversationText} onChange={ev => setNewConversationText(ev.target.value)} placeholder="כתוב עדכון שיחה..." />
                                      <Button size="sm" type="button" onClick={() => handleAddConversation(lead.id)} className="shrink-0">{'הוסף'}</Button>
                                    </div>
                                  )}
                                  <ul className="space-y-1.5 max-h-40 overflow-y-auto border rounded p-2 bg-white">
                                    {(lead.conversationSummary || []).length === 0 && <li className="text-xs text-gray-500 text-center py-2">{'אין עדכוני שיחה.'}</li>}
                                    {(lead.conversationSummary || []).map((c, idx) => (
                                      <li key={idx} className="text-xs bg-gray-50 p-1.5 border rounded">
                                        <div className="font-semibold text-gray-700">{formatDateTime(c.timestamp)}</div>
                                        <div className="text-gray-800">{c.text}</div>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div className="border-t pt-3">
                                  <Label className="font-semibold text-sm block mb-1">{'הוסף משימה מהליד:'}</Label>
                                  <div className="flex flex-col md:flex-row gap-2">
                                    <Input type="text" className="h-8 text-sm flex-1" placeholder="תיאור משימה..." value={newTaskText} onChange={ev => setNewTaskText(ev.target.value)} />
                                    <Select value={newTaskAssignTo} onValueChange={setNewTaskAssignTo}>
                                      <SelectTrigger className="h-8 text-sm w-32"><SelectValue placeholder="מוקצה ל..." /></SelectTrigger>
                                      <SelectContent>
                                        {assignableUsersWithSelf.map(user => (
                                          <SelectItem key={user.id} value={user.alias || user.email}>{user.alias || user.email}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Select value={newTaskCategory} onValueChange={setNewTaskCategory}>
                                      <SelectTrigger className="h-8 text-sm w-32"><SelectValue placeholder="קטגוריה..." /></SelectTrigger>
                                      <SelectContent>
                                        {taskCategories.map(cat => (
                                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Input type="date" className="h-8 text-sm w-32" value={newTaskDueDate} onChange={ev => setNewTaskDueDate(ev.target.value)} />
                                    <Input type="time" className="h-8 text-sm w-24" value={newTaskDueTime} onChange={ev => setNewTaskDueTime(ev.target.value)} />
                                    <Button type="button" size="sm" onClick={() => handleCreateTaskFromLead(lead)} className="shrink-0">{'➕ משימה'}</Button>
                                  </div>
                                </div>
                                <div className="flex gap-2 justify-end border-t pt-3 mt-4">
                                  <Button type="submit" size="sm">{'שמור שינויים'}</Button>
                                  <Button type="button" variant="outline" size="sm" onClick={handleCancelEdit}>{'ביטול'}</Button>
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
            // --- Compact List View ---
            <ul className="space-y-2 h-[calc(100vh-280px)] min-h-[400px] overflow-y-auto pr-1">
              {filteredCandidates.length === 0 && (<li className="text-center text-gray-500 py-6">{'אין לידים להצגה'}</li>)}
              {filteredCandidates.slice(0, rowLimit).map(lead => {
                const colorTab = leadColorTab(lead.status);
                return (
                  <li key={lead.id} className="p-2 border rounded shadow-sm flex items-center gap-2 bg-white hover:bg-gray-50">
                    <div className={`w-2 h-10 ${colorTab} rounded shrink-0`} />
                    <div className="flex-grow overflow-hidden">
                      <div className="font-bold text-sm truncate">
                        {lead.isHot && <span className="mr-1">🔥</span>}
                        {lead.fullName}
                      </div>
                      <p className="text-xs text-gray-600 truncate">{lead.message}</p>
                      <p className="text-xs text-gray-500 truncate">{lead.status} - {formatDateTime(lead.createdAt)}</p>
                      {lead.branch && (
                        <span className={`inline-block rounded-full px-2 py-0.5 ml-1 text-xs font-medium ${branchColor(lead.branch)}`}>{lead.branch}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button size="icon" variant="ghost" className="w-6 h-6 text-gray-500 hover:text-blue-600" title="פתח לעריכה" onClick={() => handleEditLead(lead)}><span role="img" aria-label="Edit" className="w-3 h-3">✎</span></Button>
                      <Tooltip><TooltipTrigger asChild><a href={`https://wa.me/${lead.phoneNumber}`} target="_blank" rel="noopener noreferrer"><Button size="icon" variant="ghost" className="w-6 h-6 text-green-600 hover:text-green-700"><span role="img" aria-label="WhatsApp">💬</span></Button></a></TooltipTrigger><TooltipContent>{'שלח וואטסאפ'}</TooltipContent></Tooltip>
                      <Button size="icon" variant="ghost" className="w-6 h-6 text-blue-600 hover:text-blue-700" title="התקשר דרך המרכזיה" onClick={() => handleClick2Call(lead.phoneNumber)}><span role="img" aria-label="Call" className="w-3 h-3">📞</span></Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-6 h-6 text-orange-600 hover:text-orange-700 text-xs"
                            onClick={() => handleIncrementFollowUp(lead.id, lead.followUpCall?.count)}
                            title="הוסף שיחת מעקב"
                          >
                            🔁 {lead.followUpCall?.count || 0}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{'הוסף שיחת מעקב'}</TooltipContent>
                      </Tooltip>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Add Lead Modal */}
      {showAddLeadModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 p-4" onClick={() => setShowAddLeadModal(false)}>
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4 text-right">{'הוספת מטופל חדש'}</h2>
            <form onSubmit={handleAddNewLead} className="space-y-4 text-right" dir="rtl">
              
              <div>
                <Label htmlFor="new-lead-name" className="block text-sm font-medium mb-1">שם מלא <span className="text-red-500">*</span></Label>
                <Input
                  id="new-lead-name" 
                  type="text" 
                  value={newLeadFullName}
                  onChange={(e) => setNewLeadFullName(e.target.value)} 
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="new-lead-phone" className="block text-sm font-medium mb-1">מספר טלפון <span className="text-red-500">*</span></Label>
                <Input
                  id="new-lead-phone" 
                  type="tel" 
                  value={newLeadPhone}
                  onChange={(e) => setNewLeadPhone(e.target.value)} 
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="new-lead-message" className="block text-sm font-medium mb-1">הודעה / הערה</Label>
                <Textarea
                  id="new-lead-message" 
                  value={newLeadMessage}
                  onChange={(e) => setNewLeadMessage(e.target.value)} 
                  rows={3}
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
                <Label htmlFor="new-lead-hot" className="text-sm font-medium cursor-pointer">ליד חם 🔥</Label>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="new-lead-status" className="block text-sm font-medium mb-1">סטטוס</Label>
                  <Select value={newLeadStatus} onValueChange={setNewLeadStatus}>
                    <SelectTrigger id="new-lead-status" className="text-right" dir="rtl">
                      <div className="flex items-center gap-2 w-full" style={{ justifyContent: 'flex-end' }}>
                        <span className={`w-3 h-3 rounded-full flex-shrink-0 ${leadStatusConfig[newLeadStatus]?.color || 'bg-gray-300'}`}></span>
                        <span className="flex-1 text-right">{newLeadStatus}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent className="text-right text-sm" dir="rtl">
                      {Object.keys(leadStatusConfig).filter(k => k !== 'Default').map(status => (
                        <SelectItem key={status} value={status} className="text-sm cursor-pointer" showDefaultCheck={false} dir="rtl">
                          <div className="flex items-center gap-2 w-full pr-1" style={{ justifyContent: 'flex-end' }}>
                            <span className={`w-3 h-3 rounded-full flex-shrink-0 ${leadStatusConfig[status].color}`}></span>
                            <span className="flex-1 text-right text-sm">{status}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="new-lead-source" className="block text-sm font-medium mb-1">מקור הגעה</Label>
                  <Select value={newLeadSource} onValueChange={setNewLeadSource}>
                    <SelectTrigger id="new-lead-source" className="text-right" dir="rtl">
                      <div className="flex items-center gap-2 w-full" style={{ justifyContent: 'flex-end' }}>
                        {newLeadSource && <span className="flex-shrink-0">{getSourceIcon(newLeadSource)}</span>}
                        <span className="flex-1 text-right">{newLeadSource || "בחר מקור..."}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent className="text-right text-sm" dir="rtl">
                      {sourceOptions.map(source => (
                        <SelectItem key={source} value={source} className="text-sm cursor-pointer" dir="rtl">
                          <div className="flex items-center gap-2 w-full pr-1" style={{ justifyContent: 'flex-end' }}>
                            <span className="flex-shrink-0">{getSourceIcon(source)}</span>
                            <span className="flex-1 text-right">{source}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {newLeadSource === "אחר" && (
                    <Input
                      type="text"
                      value={newLeadSourceOther}
                      onChange={(e) => setNewLeadSourceOther(e.target.value)}
                      placeholder="הזן מקור מותאם אישית..."
                      className="mt-2"
                    />
                  )}
                </div>
              </div>
              
              <div className="mt-6 flex flex-col items-center gap-3">
                <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-8">הוסיפי מטופל</Button>
                <Button type="button" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setShowAddLeadModal(false)}>ביטול</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}