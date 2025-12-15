"use client";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { db, auth } from "../firebase";
import { useAuth } from "@/app/context/AuthContext";
import { useData } from "@/app/context/DataContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FaWhatsapp, FaCodeBranch, FaFacebook, FaInstagram, FaSpotify, FaGlobe, FaUserFriends, FaEllipsisH } from "react-icons/fa";
import { BRANCHES, branchColor } from "@/lib/branches";
import { leadStatusConfig, leadColorTab, leadPriorityValue } from "@/lib/leadStatus";
import { normalizePhoneNumber } from "@/lib/phoneUtils";
import { Search, ChevronDown } from "lucide-react";
import { 
  collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, arrayUnion, setDoc, getDocs, getDoc, orderBy, query, deleteDoc, Timestamp
} from "firebase/firestore";

// Shared configs imported from lib

function formatDateTime(date) {
  if (!date) return "";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return `${d.toLocaleDateString("he-IL")} ${d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  } catch { return ""; }
}

function formatDate(date) {
  if (!date) return "";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("he-IL");
  } catch { return ""; }
}

function formatTime(date) {
  if (!date) return "";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch { return ""; }
}

export default function LeadManager({ isFullView, setIsFullView, blockPosition, onToggleBlockOrder, onCalendarDataChange }) {
  const { currentUser } = useAuth();
  const { leads, assignableUsers, currentUserData } = useData();
  const [taskCategories, setTaskCategories] = useState(["להתקשר", "לקבוע סדרה", "דוחות", "תשלומים וזיכויים", "תוכניות טיפול", "אחר"]);
  const [editingLeadId, setEditingLeadId] = useState(null);
  const [editLeadFullName, setEditLeadFullName] = useState("");
  const [editLeadPhone, setEditLeadPhone] = useState("");
  const [editLeadMessage, setEditLeadMessage] = useState("");
  const [editLeadStatus, setEditLeadStatus] = useState("חדש");
  const [editLeadSource, setEditLeadSource] = useState("");
  const [editLeadAppointmentDateTime, setEditLeadAppointmentDateTime] = useState("");
  const [editLeadBranch, setEditLeadBranch] = useState("");
  const [editLeadIsHot, setEditLeadIsHot] = useState(false);
  const [newConversationText, setNewConversationText] = useState("");
  const [showConvUpdate, setShowConvUpdate] = useState(null);
  const [leadSortBy, setLeadSortBy] = useState("priority");
  const [leadTimeFilter, setLeadTimeFilter] = useState("all");
  const [leadFilterFrom, setLeadFilterFrom] = useState("");
  const [leadFilterTo, setLeadFilterTo] = useState("");
  const [leadSearchTerm, setLeadSearchTerm] = useState("");
  const [leadSortDirection, setLeadSortDirection] = useState('desc');
  const [leadRowLimit, setLeadRowLimit] = useState(50);
  const allLeadCategories = useMemo(() => Object.keys(leadStatusConfig).filter(k => k !== 'Default'), []);
  const [selectedLeadCategories, setSelectedLeadCategories] = useState([]);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [persistenceReady, setPersistenceReady] = useState(false);
  const savedSelectedRef = useRef(null);
  const hasLoadedFromFirestore = useRef(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsTimeFilter, setAnalyticsTimeFilter] = useState("month");
  const [analyticsFilterFrom, setAnalyticsFilterFrom] = useState("");
  const [analyticsFilterTo, setAnalyticsFilterTo] = useState("");
  const [expandedLeadId, setExpandedLeadId] = useState(null);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [newLeadFullName, setNewLeadFullName] = useState("");
  const [newLeadPhone, setNewLeadPhone] = useState("");
  const [newLeadMessage, setNewLeadMessage] = useState("");
  const [newLeadStatus, setNewLeadStatus] = useState("חדש");
  const [newLeadSource, setNewLeadSource] = useState("");
  const [newLeadIsHot, setNewLeadIsHot] = useState(false);
  const [newLeadSourceOther, setNewLeadSourceOther] = useState("");
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
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [leadToDuplicate, setLeadToDuplicate] = useState(null);
  const [confirmingDeleteLeadId, setConfirmingDeleteLeadId] = useState(null);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [existingDuplicateLead, setExistingDuplicateLead] = useState(null);
  const [pendingNewLead, setPendingNewLead] = useState(null);
  const [processingDuplicatesManually, setProcessingDuplicatesManually] = useState(false);
  const [userHasExplicitlyChangedPrefs, setUserHasExplicitlyChangedPrefs] = useState(false);
  const alias = currentUserData?.alias || "";
  const role = currentUserData?.role || "";

  // Helper to mark that user has explicitly changed preferences
  const markPrefsChanged = useCallback(() => {
    if (!userHasExplicitlyChangedPrefs) {
      console.log('🔔 LeadManager: User explicitly changed preferences - enabling persistence');
      setUserHasExplicitlyChangedPrefs(true);
      setPersistenceReady(true); // Enable persistence now that user has made a change
    }
  }, [userHasExplicitlyChangedPrefs]);

  // Load persisted lead filters/preferences and block layout from Firestore
  useEffect(() => {
    if (!currentUser) {
      console.log('📥 LeadManager: No currentUser, skipping load');
      return;
    }
    console.log('📥 LeadManager: Starting to load preferences for user:', currentUser.uid);
    const loadPrefs = async () => {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          hasLoadedFromFirestore.current = true;
          const d = snap.data();
          console.log('📥 LeadManager: User document exists:', {
            lead_selectedCategories: d.lead_selectedCategories,
            hasField: 'lead_selectedCategories' in d,
            isArray: Array.isArray(d.lead_selectedCategories)
          });
          if (d.lead_sortBy) setLeadSortBy(d.lead_sortBy);
          if (d.lead_sortDirection) setLeadSortDirection(d.lead_sortDirection);
          if (d.lead_timeFilter) setLeadTimeFilter(d.lead_timeFilter);
          if (typeof d.lead_filterFrom === 'string') setLeadFilterFrom(d.lead_filterFrom);
          if (typeof d.lead_filterTo === 'string') setLeadFilterTo(d.lead_filterTo);
          if (typeof d.lead_searchTerm === 'string') setLeadSearchTerm(d.lead_searchTerm);
          if (typeof d.lead_rowLimit === 'number') setLeadRowLimit(d.lead_rowLimit);
          
          // Handle category selection properly - check if field exists explicitly
          if ('lead_selectedCategories' in d && Array.isArray(d.lead_selectedCategories)) {
            console.log('✅ LeadManager: Setting categories from Firestore:', d.lead_selectedCategories);
            savedSelectedRef.current = d.lead_selectedCategories;
            setSelectedLeadCategories(d.lead_selectedCategories);
          } else {
            // Only default to all categories if never saved before
            console.log('⚠️ LeadManager: No saved categories, defaulting to all');
            savedSelectedRef.current = allLeadCategories;
            setSelectedLeadCategories(allLeadCategories);
          }
          
          if (typeof d.leads_isFullView === 'boolean') setIsFullView(d.leads_isFullView);
        } else {
          // No user document exists, default to all categories
          // Set flag to FALSE because we didn't actually load from Firestore
          hasLoadedFromFirestore.current = false; // NOT loaded from Firestore
          console.log('⚠️ LeadManager: No user document exists yet, defaulting to all');
          console.log('⚠️ LeadManager: Will NOT auto-save defaults - waiting for explicit user changes');
          savedSelectedRef.current = allLeadCategories;
          setSelectedLeadCategories(allLeadCategories);
          // Don't enable persistence for defaults - only when user explicitly changes something
        }
        console.log('✅ LeadManager: Setting prefsLoaded=true');
        setPrefsLoaded(true);
        // Only set persistenceReady if we successfully loaded existing preferences
        if (snap.exists()) {
          setTimeout(() => {
            console.log('✅ LeadManager: Setting persistenceReady=true (loaded existing prefs)');
            setPersistenceReady(true);
          }, 500);
        }
      } catch (err) {
        console.error('❌ LeadManager: Error loading lead prefs:', err);
        // On error, default to all categories
        savedSelectedRef.current = allLeadCategories;
        setSelectedLeadCategories(allLeadCategories);
        setPrefsLoaded(true);
        setTimeout(() => setPersistenceReady(true), 500);
      }
    };
    loadPrefs();
  }, [currentUser, setIsFullView]);

  // Persist lead filters/preferences and block layout to Firestore
  useEffect(() => {
    if (!currentUser || !prefsLoaded) {
      console.log('💾 LeadManager: Skipping persistence:', { currentUser: !!currentUser, prefsLoaded, persistenceReady, userHasExplicitlyChangedPrefs });
      return;
    }
    
    // Only persist if:
    // 1. We successfully loaded existing preferences (persistenceReady), OR
    // 2. User has explicitly changed something (userHasExplicitlyChangedPrefs)
    if (!persistenceReady && !userHasExplicitlyChangedPrefs) {
      console.log('💾 LeadManager: Skipping persistence - no existing prefs loaded and no explicit changes yet');
      return;
    }
    
    // Only persist if we've successfully loaded preferences from Firestore OR user has explicitly changed something
    // This prevents persisting defaults before we've tried to load
    if (!hasLoadedFromFirestore.current && !userHasExplicitlyChangedPrefs) {
      console.log('💾 LeadManager: Skipping persistence - waiting for Firestore load');
      return;
    }
    
    console.log('💾 LeadManager: Persisting preferences:', {
      selectedLeadCategories,
      leadSortBy,
      leadSortDirection,
      leadTimeFilter,
      leadSearchTerm,
      leadRowLimit,
      isFullView,
      uid: currentUser.uid
    });
    
    // Update the ref to keep it in sync with current selection
    savedSelectedRef.current = selectedLeadCategories;
    const userRef = doc(db, 'users', currentUser.uid);
    
    const dataToSave = {
      lead_sortBy: leadSortBy,
      lead_sortDirection: leadSortDirection,
      lead_timeFilter: leadTimeFilter,
      lead_filterFrom: leadFilterFrom,
      lead_filterTo: leadFilterTo,
      lead_searchTerm: leadSearchTerm,
      lead_selectedCategories: selectedLeadCategories,
      lead_rowLimit: leadRowLimit,
      leads_isFullView: isFullView,
      updatedAt: serverTimestamp(),
    };
    
    console.log('💾 LeadManager: Data to save:', dataToSave);
    
    setDoc(userRef, dataToSave, { merge: true })
      .then(() => {
        console.log('✅ LeadManager: Successfully wrote to Firestore!');
        console.log('✅ LeadManager: Saved data:', dataToSave);
        // Once we've saved once, enable persistence for future changes
        if (!persistenceReady) {
          setPersistenceReady(true);
        }
      })
      .catch((err) => {
        console.error('❌ LeadManager: Error persisting lead prefs:', err);
        console.error('❌ LeadManager: Failed to save:', dataToSave);
      });
  }, [currentUser, prefsLoaded, persistenceReady, userHasExplicitlyChangedPrefs, leadSortBy, leadSortDirection, leadTimeFilter, leadFilterFrom, leadFilterTo, leadSearchTerm, selectedLeadCategories, leadRowLimit, isFullView]);

  // Bridge analytics toggle to page.js (to show the original analytics panel)
  useEffect(() => {
    try {
      window.dispatchEvent(new CustomEvent('toggle-lead-analytics', { detail: { open: showAnalytics } }));
    } catch {}
  }, [showAnalytics]);

  // Leads now come from DataContext

  // Calendar event bridge from leads
  const leadAppointmentEvents = useMemo(() => {
    return leads.filter(lead => lead.status === 'תור נקבע' && lead.appointmentDateTime).map(lead => {
      try {
        const start = new Date(lead.appointmentDateTime); if (isNaN(start.getTime())) return null;
        const end = new Date(start.getTime() + 15 * 60 * 1000);
        return { id: `lead-${lead.id}`, title: `פגישה: ${lead.fullName}`, start, end, assignTo: currentUser?.email || "", resource: { type: 'lead', data: lead } };
      } catch { return null; }
    }).filter(Boolean);
  }, [leads, currentUser]);

  useEffect(() => { if (onCalendarDataChange) onCalendarDataChange({ events: leadAppointmentEvents }); }, [leadAppointmentEvents, onCalendarDataChange]);

  // Allow calendar to open a specific lead for editing
  useEffect(() => {
    function handleOpenLead(e) {
      if (e.detail && e.detail.leadId) {
        const lead = leads.find(l => l.id === e.detail.leadId);
        if (lead) {
          // inline edit logic to avoid referencing handleEditLead before init
          setEditingLeadId(lead.id);
          setEditLeadFullName(lead.fullName);
          setEditLeadPhone(lead.phoneNumber);
          setEditLeadMessage(lead.message);
          setEditLeadStatus(lead.status || "חדש");
          setEditLeadSource(lead.source || "");
          setEditLeadAppointmentDateTime(lead.appointmentDateTime || "");
          setNewConversationText("");
          setEditLeadBranch(lead.branch || "");
          setEditLeadIsHot(lead.isHot || false);
          setExpandedLeadId(e.detail.leadId);
        }
      }
    }
    window.addEventListener('open-lead', handleOpenLead);
    return () => window.removeEventListener('open-lead', handleOpenLead);
  }, [leads]);

  // Filters and sorting
  const isLeadInTimeRange = useCallback((lead) => {
    try {
      const created = new Date(lead.createdAt); if (isNaN(created.getTime())) return false;
      const now = new Date(); const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (leadTimeFilter === "week") { const oneWeekAgo = new Date(todayStart); oneWeekAgo.setDate(todayStart.getDate() - 7); return created >= oneWeekAgo; }
      else if (leadTimeFilter === "month") { const oneMonthAgo = new Date(todayStart); oneMonthAgo.setMonth(todayStart.getMonth() - 1); return created >= oneMonthAgo; }
      else if (leadTimeFilter === "custom") {
        let inRange = true;
        if (leadFilterFrom) { const fromDate = new Date(leadFilterFrom); fromDate.setHours(0,0,0,0); if (!isNaN(fromDate.getTime()) && created < fromDate) inRange = false; }
        if (leadFilterTo) { const toDate = new Date(leadFilterTo); toDate.setHours(23,59,59,999); if (!isNaN(toDate.getTime()) && created > toDate) inRange = false; }
        return inRange;
      } else { return true; }
    } catch { return false; }
  }, [leadTimeFilter, leadFilterFrom, leadFilterTo]);

  const compareLeads = useCallback((a, b) => {
    if (leadSortBy === "priority") {
      const priorityDiff = leadPriorityValue(a.status) - leadPriorityValue(b.status);
      if (priorityDiff !== 0) return priorityDiff;
      try { const dateA = new Date(a.createdAt); const dateB = new Date(b.createdAt); return leadSortDirection === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime(); } catch { return 0; }
    } else {
      try { const dateA = new Date(a.createdAt); const dateB = new Date(b.createdAt); return leadSortDirection === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime(); } catch { return 0; }
    }
  }, [leadSortBy, leadSortDirection]);

  const leadsSorted = useMemo(() => {
    const lowerSearchTerm = leadSearchTerm.toLowerCase();
    let filtered = leads.filter(isLeadInTimeRange).filter(lead => selectedLeadCategories.includes(lead.status)).filter(lead => {
      if (!lowerSearchTerm) return true;
      return lead.fullName?.toLowerCase().includes(lowerSearchTerm) || lead.phoneNumber?.includes(lowerSearchTerm) || lead.message?.toLowerCase().includes(lowerSearchTerm) || lead.source?.toLowerCase().includes(lowerSearchTerm) || lead.status?.toLowerCase().includes(lowerSearchTerm);
    });
    const grouped = {}; filtered.forEach(lead => { if (!grouped[lead.status]) grouped[lead.status] = []; grouped[lead.status].push(lead); });
    let result = []; allLeadCategories.forEach(cat => { if (grouped[cat]) { result = result.concat(grouped[cat].sort(compareLeads)); } });
    return result;
  }, [leads, leadSearchTerm, isLeadInTimeRange, compareLeads, selectedLeadCategories, allLeadCategories]);

  // Actions
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
    setEditLeadIsHot(lead.isHot || false);
  }, []);

  const handleSaveLead = useCallback(async (e, leadId) => {
    e.preventDefault(); if (!currentUser) return;
    try {
      let appointmentDate = null;
      if (editLeadStatus === 'תור נקבע' && editLeadAppointmentDateTime) {
        appointmentDate = new Date(editLeadAppointmentDateTime); if (isNaN(appointmentDate.getTime())) { alert("תאריך פגישה לא תקין."); return; }
      }
      const leadRef = doc(db, 'leads', leadId); const leadDoc = await getDoc(leadRef); if (!leadDoc.exists()) throw new Error('Lead not found');
      const originalLead = leadDoc.data();
      const updateData = { fullName: editLeadFullName, phoneNumber: editLeadPhone, message: editLeadMessage, status: editLeadStatus, source: editLeadSource, branch: editLeadBranch, isHot: editLeadIsHot, appointmentDateTime: editLeadStatus === 'תור נקבע' ? (appointmentDate || null) : null, updatedAt: serverTimestamp(), updatedBy: currentUser.uid };
      if (originalLead.status !== editLeadStatus) { updateData.followUpCall = { active: false, count: 0 }; }
      await updateDoc(leadRef, updateData);
      if (originalLead.status !== 'תור נקבע' && editLeadStatus === 'תור נקבע' && appointmentDate) {
        const taskRef = doc(collection(db, "tasks"));
        const newTask = { id: taskRef.id, userId: currentUser.uid, creatorId: currentUser.uid, creatorAlias: alias || currentUser.email || "", assignTo: currentUser.email, title: `פגישת ייעוץ - ${editLeadFullName}`, subtitle: `נקבעה פגישה מליד ${leadId}`, priority: "רגיל", category: "לקבוע סדרה", status: "פתוח", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), dueDate: appointmentDate, replies: [], isRead: false, isArchived: false, done: false, completedBy: null, completedAt: null, branch: editLeadBranch };
        await setDoc(taskRef, newTask);
      }
      setEditingLeadId(null); setEditLeadAppointmentDateTime("");
    } catch { alert("שגיאה בשמירת הליד"); }
  }, [currentUser, alias, editLeadFullName, editLeadPhone, editLeadMessage, editLeadStatus, editLeadSource, editLeadAppointmentDateTime, editLeadBranch, editLeadIsHot]);

  const handleCollapseLead = useCallback((leadId) => {
    setExpandedLeadId(null);
    if (editingLeadId === leadId) { setEditingLeadId(null); setEditLeadAppointmentDateTime(""); }
  }, [editingLeadId]);

  const handleAddConversation = useCallback(async (leadId) => {
    if (!newConversationText.trim() || !currentUser) return;
    try {
      const leadRef = doc(db, 'leads', leadId);
      const newEntry = { text: newConversationText, timestamp: Timestamp.fromDate(new Date()), userId: currentUser.uid, userAlias: alias || currentUser.email };
      await updateDoc(leadRef, { conversationSummary: arrayUnion(newEntry), updatedAt: serverTimestamp() });
      setNewConversationText(""); setShowConvUpdate(leadId);
    } catch { alert("שגיאה בהוספת עדכון שיחה"); }
  }, [newConversationText, currentUser, alias]);

  const handleAddNewLead = useCallback(async (e) => {
    e.preventDefault(); 
    if (!newLeadFullName.trim() || !newLeadPhone.trim()) { 
      alert("אנא מלא שם מלא ומספר טלפון."); 
      return; 
    }
    
    // Check for duplicates
    const normalizedPhone = normalizePhoneNumber(newLeadPhone.trim());
    const existingLead = leads.find(lead => {
      const leadNormalizedPhone = normalizePhoneNumber(lead.phoneNumber);
      return leadNormalizedPhone === normalizedPhone;
    });

    if (existingLead) {
      // Show duplicate warning
      setExistingDuplicateLead(existingLead);
      const finalSource = newLeadSource === "אחר" ? newLeadSourceOther.trim() : newLeadSource;
      setPendingNewLead({
        fullName: newLeadFullName.trim(),
        phoneNumber: newLeadPhone.trim(),
        message: newLeadMessage.trim(),
        status: newLeadStatus,
        source: finalSource,
        isHot: newLeadIsHot
      });
      setShowDuplicateWarning(true);
      return;
    }

    // No duplicate, add directly
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
    } catch { 
      alert("שגיאה בהוספת ליד חדש. נסה שוב."); 
    }
  }, [newLeadFullName, newLeadPhone, newLeadMessage, newLeadStatus, newLeadSource, newLeadSourceOther, newLeadIsHot, leads]);

  const confirmAddDuplicateLead = async () => {
    if (!pendingNewLead) return;
    try {
      await addDoc(collection(db, "leads"), {
        createdAt: serverTimestamp(),
        fullName: pendingNewLead.fullName,
        phoneNumber: pendingNewLead.phoneNumber,
        message: pendingNewLead.message,
        status: pendingNewLead.status,
        source: pendingNewLead.source,
        conversationSummary: [],
        isHot: pendingNewLead.isHot,
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
      setShowDuplicateWarning(false);
      setPendingNewLead(null);
      setExistingDuplicateLead(null);
    } catch {
      alert("שגיאה בהוספת ליד חדש. נסה שוב.");
    }
  };

  const handleProcessExistingDuplicates = async () => {
    if (processingDuplicatesManually || !currentUser) return;
    
    setProcessingDuplicatesManually(true);
    
    try {
      // Group leads by normalized phone number
      const phoneGroups = {};
      
      leads.forEach(lead => {
        if (!lead.phoneNumber) return;
        const normalizedPhone = normalizePhoneNumber(lead.phoneNumber);
        if (!normalizedPhone) return;
        
        if (!phoneGroups[normalizedPhone]) {
          phoneGroups[normalizedPhone] = [];
        }
        phoneGroups[normalizedPhone].push(lead);
      });

      let duplicatesFound = 0;
      let duplicatesProcessed = 0;

      // Process groups with duplicates
      for (const [normalizedPhone, group] of Object.entries(phoneGroups)) {
        if (group.length > 1) {
          duplicatesFound++;
          
          // Sort by createdAt descending (newest first)
          group.sort((a, b) => b.createdAt - a.createdAt);
          
          const newestLead = group[0];
          const olderLeads = group.slice(1);

          try {
            // Merge conversation histories from older leads
            const mergedConversations = [...newestLead.conversationSummary];
            const mergedFromIds = [];

            olderLeads.forEach(oldLead => {
              if (oldLead.conversationSummary && oldLead.conversationSummary.length > 0) {
                mergedConversations.push(...oldLead.conversationSummary);
              }
              mergedFromIds.push(oldLead.id);
            });

            // Sort conversations by timestamp
            mergedConversations.sort((a, b) => {
              const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
              const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
              return timeB - timeA;
            });

            // Update the newest lead with duplicate marker and merged data
            const newestLeadRef = doc(db, 'leads', newestLead.id);
            await updateDoc(newestLeadRef, {
              isDuplicate: true,
              duplicateCount: group.length,
              mergedFromLeadIds: mergedFromIds,
              conversationSummary: mergedConversations,
              updatedAt: serverTimestamp()
            });

            // Delete older duplicate leads
            for (const oldLead of olderLeads) {
              try {
                await deleteDoc(doc(db, 'leads', oldLead.id));
                console.log(`🗑️ Deleted duplicate lead: ${oldLead.id} (phone: ${oldLead.phoneNumber})`);
              } catch (error) {
                console.error(`Error deleting duplicate lead ${oldLead.id}:`, error);
              }
            }

            duplicatesProcessed++;
            console.log(`✅ Processed ${group.length} duplicate leads for phone: ${normalizedPhone}`);
          } catch (error) {
            console.error('Error handling duplicate group:', error);
          }
        }
      }

      if (duplicatesFound === 0) {
        alert("לא נמצאו לידים כפולים במערכת! ✅");
      } else {
        alert(`✅ סיים לעבד ${duplicatesProcessed} קבוצות כפולות!\nנמחקו ${duplicatesProcessed > 0 ? (leads.length - (leads.length - duplicatesProcessed)) : 0} לידים ישנים.`);
      }
    } catch (error) {
      console.error('Error processing existing duplicates:', error);
      alert("שגיאה בעיבוד לידים כפולים. נסה שוב.");
    } finally {
      setProcessingDuplicatesManually(false);
    }
  };

  const handleDeleteLead = async (leadId) => {
    if (!(currentUser?.role === "admin" || role === "admin")) { alert("רק אדמין יכול למחוק לידים"); return; }
    if (confirmingDeleteLeadId !== leadId) { setConfirmingDeleteLeadId(leadId); return; }
    try { await deleteDoc(doc(db, "leads", leadId)); setConfirmingDeleteLeadId(null); } catch { alert("שגיאה במחיקת ליד"); setConfirmingDeleteLeadId(null); }
  };

  const handleDuplicateLead = (lead) => {
    setLeadToDuplicate(lead);
    setShowDuplicateConfirm(true);
  };

  const confirmDuplicateLead = async () => {
    if (!leadToDuplicate) return;
    try { 
      const duplicatedLead = { 
        ...leadToDuplicate, 
        fullName: leadToDuplicate.fullName + " משוכפל", 
        createdAt: serverTimestamp(), 
        isHot: true 
      }; 
      delete duplicatedLead.id; 
      await addDoc(collection(db, "leads"), duplicatedLead); 
      alert("הליד שוכפל"); 
    } catch { 
      alert("שגיאה בשכפול ליד"); 
    } finally {
      setShowDuplicateConfirm(false);
      setLeadToDuplicate(null);
    }
  };

  const handleFollowUpClick = async (lead) => {
    if (!currentUser) return; if (holdLeadId === lead.id) return;
    if (!lead.followUpCall?.active && (!lead.followUpCall || lead.followUpCall.count === 0)) { const leadRef = doc(db, 'leads', lead.id); await updateDoc(leadRef, { followUpCall: { active: true, count: 1 } }); }
    else if (lead.followUpCall?.active) { const leadRef = doc(db, 'leads', lead.id); await updateDoc(leadRef, { followUpCall: { active: true, count: (lead.followUpCall.count || 1) + 1 } }); }
  };

  const [holdLeadId, setHoldLeadId] = useState(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdAnimationRef = useRef();
  const holdDelayTimeout = useRef();
  const handleFollowUpReset = async (lead) => {
    if (!currentUser) return; const leadRef = doc(db, 'leads', lead.id); await updateDoc(leadRef, { followUpCall: { active: false, count: 0 } }); setTimeout(() => { setHoldLeadId(null); setHoldProgress(0); }, 50);
  };
  const handleHoldStart = (lead) => { setHoldLeadId(lead.id); setHoldProgress(0); holdDelayTimeout.current = setTimeout(() => { const start = Date.now(); function animate() { const elapsed = Date.now() - start; const progress = Math.min(elapsed / 1200, 1); setHoldProgress(progress); if (progress < 1) { holdAnimationRef.current = requestAnimationFrame(animate); } else { handleFollowUpReset(lead); } } holdAnimationRef.current = requestAnimationFrame(animate); }, 300); };
  const handleHoldEnd = () => { setHoldLeadId(null); setHoldProgress(0); if (holdDelayTimeout.current) clearTimeout(holdDelayTimeout.current); if (holdAnimationRef.current) cancelAnimationFrame(holdAnimationRef.current); };

  // Click2Call
  const handleClick2Call = async (phoneNumber) => {
    const userExt = currentUserData?.EXT || "";
    if (!userExt) { 
      alert("לא הוגדרה שלוחה (EXT) למשתמש זה. פנה למנהל המערכת."); 
      return; 
    }
    const apiUrl = "https://master.ippbx.co.il/ippbx_api/v1.4/api/info/click2call";
    const payload = { 
      token_id: "22K3TWfeifaCPUyA", 
      phone_number: phoneNumber, 
      extension_number: String(userExt),
      extension_password: "bdb307dc55bf1e679c296ee5c73215cb" 
    };
    try {
      const response = await fetch(apiUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) { 
        const errorText = await response.text(); 
        alert(errorText || "לא ניתן היה להפעיל שיחה דרך המרכזיה."); 
        return; 
      }
      alert(`שיחה ל-${phoneNumber} הופעלה דרך המרכזיה.`);
    } catch (error) { 
      alert(error.message || "לא ניתן היה להפעיל שיחה דרך המרכזיה."); 
    }
  };

  // Derived analytics (shortened summary for now)
  const calculatedAnalytics = useMemo(() => {
    // Keep minimal to preserve structure; detailed logic stays similar
    const statusCounts = leads.reduce((acc, lead) => { acc[lead.status] = (acc[lead.status] || 0) + 1; return acc; }, {});
    return { totalLeads: leads.length, statusCounts, range: { start: '', end: '' }, graphData: [], leadsPerDay: '0.0', conversionRate: '0.0', firstConversionRate: '0.0', secondConversionRate: '0.0', avgAnswerTimeHours: 'N/A' };
  }, [leads]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        {isFullView ? (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <CardTitle className="text-xl font-bold">{'ניהול לידים (מלא)'}</CardTitle>
                <Button size="sm" onClick={() => setShowAddLeadModal(true)} className="bg-green-600 hover:bg-green-700 text-white">{'+ הוסיפי ליד'}</Button>
              </div>
              <div className="flex gap-2 items-center">
                <Button onClick={() => setIsFullView(false)} size="sm" variant="outline" className="h-9">{'תצוגה מקוצרת'}</Button>
                <Button size="sm" onClick={onToggleBlockOrder} variant="outline" className="h-9">{'מיקום: '}{blockPosition}</Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-2 border-t pt-2">
              <Select value={leadSortBy} onValueChange={(val) => { markPrefsChanged(); setLeadSortBy(val); }}>
                <SelectTrigger className="h-9 text-sm w-[120px]"><SelectValue placeholder="סדר לפי..." /></SelectTrigger>
                <SelectContent><SelectItem value="priority">{'עדיפות'}</SelectItem><SelectItem value="date">{'תאריך יצירה'}</SelectItem></SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="h-9 text-sm w-[44px] px-2" onClick={() => { markPrefsChanged(); setLeadSortDirection(dir => dir === 'asc' ? 'desc' : 'asc'); }} title={leadSortDirection === 'asc' ? 'סדר עולה' : 'סדר יורד'}>{leadSortDirection === 'asc' ? '⬆️' : '⬇️'}</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 text-sm w-[160px] justify-between">
                    <span>{selectedLeadCategories.length === allLeadCategories.length ? "כל הקטגוריות" : selectedLeadCategories.length === 1 ? allLeadCategories.find(cat => cat === selectedLeadCategories[0]) : `${selectedLeadCategories.length} נבחרו`}</span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[160px] text-right" dir="rtl">
                  <DropdownMenuLabel>{'סינון קטגוריה'}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {allLeadCategories.map((category) => {
                    const selected = selectedLeadCategories.includes(category);
                    return (
                      <div key={category} onClick={() => { markPrefsChanged(); setSelectedLeadCategories(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]); }} className="flex flex-row items-center justify-between cursor-pointer py-1 px-2" style={{ direction: 'rtl' }}>
                        <span className="flex items-center gap-2 w-full justify-between">
                          <span className={`inline-block w-4 h-4 rounded-full ${leadStatusConfig[category]?.color || 'bg-gray-300'} flex items-center justify-center`} style={{ border: selected ? '2px solid #222' : '2px solid transparent', transition: 'border 0.2s' }}>{selected && (<span className="w-2 h-2 bg-white rounded-full block"></span>)}</span>
                          <span className="flex-1 text-right">{category}</span>
                        </span>
                      </div>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                variant="outline"
                className="h-9 text-sm px-3"
                onClick={() => { markPrefsChanged(); setSelectedLeadCategories(allLeadCategories); }}
              >
                כולם
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 text-sm px-3"
                onClick={() => { markPrefsChanged(); setSelectedLeadCategories(["חדש", "ממתין לתשובה של ד״ר וינטר"]); }}
              >
                ראשי
              </Button>
              <Select value={String(leadRowLimit)} onValueChange={(val) => { markPrefsChanged(); setLeadRowLimit(Number(val)); }}>
                <SelectTrigger className="h-9 text-sm w-[80px]"><SelectValue /></SelectTrigger>
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
              <div className="flex items-center gap-2 px-3 h-9 bg-blue-50 border border-blue-200 rounded-md">
                <span className="text-sm font-medium text-blue-900">מתוך:</span>
                <span className="text-lg font-bold text-blue-700 leading-none">{leadsSorted.length}</span>
                <span className="text-sm font-medium text-blue-900">לידים</span>
              </div>
              <Select value={leadTimeFilter} onValueChange={(val) => { markPrefsChanged(); setLeadTimeFilter(val); }}>
                <SelectTrigger className="h-9 text-sm w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{'הכל'}</SelectItem>
                  <SelectItem value="week">{'שבוע אחרון'}</SelectItem>
                  <SelectItem value="month">{'חודש אחרון'}</SelectItem>
                  <SelectItem value="custom">{'טווח תאריכים'}</SelectItem>
                </SelectContent>
              </Select>
              {leadTimeFilter === "custom" && (
                <div className="flex flex-wrap items-center gap-2">
                  <Input type="date" value={leadFilterFrom} onChange={(e) => { markPrefsChanged(); setLeadFilterFrom(e.target.value); }} className="h-9 text-sm w-[140px]" placeholder="מתאריך..." />
                  <Input type="date" value={leadFilterTo} onChange={(e) => { markPrefsChanged(); setLeadFilterTo(e.target.value); }} className="h-9 text-sm w-[140px]" placeholder="עד תאריך..." />
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input type="search" placeholder="חפש לידים..." className="h-9 text-sm pl-8 w-[200px]" value={leadSearchTerm} onChange={(e) => { markPrefsChanged(); setLeadSearchTerm(e.target.value); }} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <CardTitle>{'ניהול לידים'}</CardTitle>
              <div className="flex gap-2">
                <Button onClick={() => setIsFullView(true)} size="sm">{'תצוגה מלאה'}</Button>
                <Button size="xs" onClick={onToggleBlockOrder} variant="outline">{'מיקום: '}{blockPosition}</Button>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-md w-fit">
              <span className="text-sm font-medium text-blue-900">מציג:</span>
              <span className="text-lg font-bold text-blue-700">{leadsSorted.length}</span>
              <span className="text-sm font-medium text-blue-900">לידים</span>
            </div>
          </div>
        )}
        <div className="mt-2 pt-2 border-t flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowAnalytics(!showAnalytics)}>{showAnalytics ? 'הסתר ניתוח לידים' : 'הצג ניתוח לידים'}</Button>
          {false && <Button 
            variant="outline" 
            size="sm" 
            onClick={handleProcessExistingDuplicates}
            disabled={processingDuplicatesManually}
            className="border-orange-300 text-orange-700 hover:bg-orange-50"
          >
            {processingDuplicatesManually ? '⏳ מעבד...' : '🔄 עבד לידים כפולים'}
            </Button>}
            </div>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col overflow-hidden">
        {isFullView ? (
          <div className="flex-grow overflow-auto">
            <table className="w-full table-fixed text-sm border-collapse">
              <thead className="sticky top-0 bg-gray-100 z-10">
                <tr>
                  <th className="px-1 py-2 text-right font-semibold w-12"></th>
                  <th className="px-1 py-2 text-right font-semibold w-28">{'תאריך'}</th>
                  <th className="px-1 py-2 text-right font-semibold w-36">{'שם מלא'}</th>
                  <th className="px-1 py-2 text-right font-semibold w-28">{'טלפון'}</th>
                  <th className="px-1 py-2 text-right font-semibold">{'הודעה'}</th>
                  <th className="px-1 py-2 text-center font-semibold w-16">{'פולואפ'}</th>
                  <th className="px-1 py-2 text-right font-semibold w-28">{'פעולות'}</th>
                </tr>
              </thead>
              <tbody>
                {leadsSorted.length === 0 && (<tr><td colSpan={7} className="text-center text-gray-500 py-6">{'אין לידים להצגה'}</td></tr>)}
                {leadsSorted.slice(0, leadRowLimit).map((lead) => {
                  const colorTab = leadColorTab(lead.status);
                  return (
                    <React.Fragment key={`lead-rows-${lead.id}`}>
                      <tr className="border-b hover:bg-gray-50 group">
                        <td className="px-1 py-2 align-top"><div className={`w-4 h-8 ${colorTab} rounded mx-auto`} /></td>
                        <td className="px-1 py-2 align-top">
                          <div className="text-xs leading-tight">{formatDate(lead.createdAt)}</div>
                          <div className="text-xs text-gray-500 leading-tight">{formatTime(lead.createdAt)}</div>
                        </td>
                        <td className="px-1 py-2 align-top font-medium truncate">
                          {lead.isHot && <span className="mr-1">🔥</span>}
                          {lead.isDuplicate && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-orange-500 font-bold mr-1" style={{ fontSize: '10px', cursor: 'help' }}>
                                  ••{lead.duplicateCount > 2 ? `×${lead.duplicateCount}` : ''}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-xs">
                                  <div>ליד משוכפל</div>
                                  <div>מוזג מ-{lead.duplicateCount - 1} ליד{lead.duplicateCount > 2 ? 'ים' : ''} קודם{lead.duplicateCount > 2 ? 'ים' : ''}</div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {lead.fullName}
                        </td>
                        <td className="px-1 py-2 align-top whitespace-nowrap text-xs">{lead.phoneNumber}</td>
                        <td className="px-1 py-2 align-top truncate text-xs" title={lead.message}>{lead.message}</td>
                        <td className="px-1 py-2 align-top text-center">
                          <button className="relative group" style={{ outline: 'none', border: 'none', background: 'none', cursor: 'pointer' }} onClick={() => { if (holdLeadId === lead.id) return; if (!lead.followUpCall?.active && (!lead.followUpCall || lead.followUpCall.count === 0)) { handleFollowUpClick(lead); } else if (lead.followUpCall?.active) { handleFollowUpClick(lead); } }} onMouseDown={() => handleHoldStart(lead)} onMouseUp={handleHoldEnd} onMouseLeave={handleHoldEnd} tabIndex={0} aria-label="סמן פולואפ טלפון">
                            <svg width="24" height="24" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <circle cx="14" cy="14" r="13" stroke={lead.followUpCall?.active ? '#22c55e' : '#e5e7eb'} strokeWidth="2" fill={lead.followUpCall?.active ? '#22c55e' : 'white'} />
                              <circle cx="14" cy="14" r="13" stroke="#22c55e" strokeWidth="3" fill="none" strokeDasharray={2 * Math.PI * 13} strokeDashoffset={(1 - (holdLeadId === lead.id ? holdProgress : 0)) * 2 * Math.PI * 13} style={{ transition: 'stroke-dashoffset 0.1s linear' }} />
                              <path d="M19.5 17.5c-1.5 0-3-.5-4.5-2s-2-3-2-4.5c0-.5.5-1 1-1h2c.5 0 1 .5 1 1 0 .5.5 1 1 1s1-.5 1-1c0-2-1.5-3.5-3.5-3.5S9.5 9.5 9.5 11.5c0 4.5 3.5 8 8 8 .5 0 1-.5 1-1v-2c0-.5-.5-1-1-1z" fill={lead.followUpCall?.active ? 'white' : '#a3a3a3'} />
                            </svg>
                            {lead.followUpCall?.active && lead.followUpCall?.count > 1 && (<span className="absolute -top-1 -right-1 bg-green-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center border border-white">{lead.followUpCall.count}</span>)}
                          </button>
                        </td>
                        <td className="px-1 py-2 align-top">
                          <div className="flex items-center justify-start gap-0.5">
                            <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="w-6 h-6 text-gray-500 hover:text-blue-600" title="פתח לעריכה" onClick={async () => { if (lead.id === expandedLeadId) { const fakeEvent = { preventDefault: () => {} }; await handleSaveLead(fakeEvent, lead.id); setExpandedLeadId(null); } else { handleEditLead(lead); setExpandedLeadId(lead.id); } }}><span role="img" aria-label="Edit" className="w-3 h-3">✎</span></Button></TooltipTrigger><TooltipContent>{'פתח/ערוך ליד'}</TooltipContent></Tooltip>
                            <Tooltip><TooltipTrigger asChild><a href={`https://wa.me/${lead.phoneNumber}`} target="_blank" rel="noopener noreferrer"><Button size="icon" variant="ghost" className="w-6 h-6 text-green-600 hover:text-green-700"><FaWhatsapp className="w-3 h-3" /></Button></a></TooltipTrigger><TooltipContent>{'שלח וואטסאפ'}</TooltipContent></Tooltip>
                            <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="w-6 h-6 text-blue-600 hover:text-blue-700" onClick={() => handleClick2Call(lead.phoneNumber)}><span role="img" aria-label="Call" className="w-3 h-3">📞</span></Button></TooltipTrigger><TooltipContent>{'התקשר דרך המרכזיה'}</TooltipContent></Tooltip>
                            {(currentUser?.role === 'admin' || role === 'admin') && (<Tooltip><TooltipTrigger asChild><Button size="icon" variant="destructive" className="w-6 h-6 text-red-600 hover:text-red-700" onClick={() => handleDeleteLead(lead.id)} title="מחק ליד"><span role="img" aria-label="Delete">🗑️</span></Button></TooltipTrigger><TooltipContent>מחק ליד</TooltipContent></Tooltip>)}
                            <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="w-6 h-6 text-purple-600 hover:text-purple-700" onClick={() => handleDuplicateLead(lead)} title="שכפל ליד"><FaCodeBranch className="w-3 h-3" /></Button></TooltipTrigger><TooltipContent>{'שכפל ליד'}</TooltipContent></Tooltip>
                          </div>
                        </td>
                      </tr>
                      {lead.id === expandedLeadId && (
                        <tr key={`expanded-${lead.id}`} className="border-b bg-blue-50">
                          <td colSpan={7} className="p-4">
                            <form onSubmit={(e) => handleSaveLead(e, lead.id)} className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <Label className="block"><span className="text-gray-700 text-sm font-medium">{'שם מלא:'}</span><Input type="text" className="mt-1 h-8 text-sm" value={editLeadFullName} onChange={(ev) => setEditLeadFullName(ev.target.value)} required /></Label>
                                <Label className="block"><span className="text-gray-700 text-sm font-medium">{'טלפון:'}</span><Input type="tel" className="mt-1 h-8 text-sm" value={editLeadPhone} onChange={(ev) => setEditLeadPhone(ev.target.value)} required /></Label>
                                <Textarea rows={4} className="mt-1 text-sm resize-y" value={editLeadMessage} onChange={(ev) => setEditLeadMessage(ev.target.value)} />
                                <Label className="block"><span className="text-gray-700 text-sm font-medium">{'סטטוס:'}</span>
                                  <Select value={editLeadStatus} onValueChange={setEditLeadStatus}>
                                    <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="בחר..." /></SelectTrigger>
                                    <SelectContent className="text-right" dir="rtl">
                                      {Object.keys(leadStatusConfig).filter(k => k !== 'Default').map(status => (
                                        <SelectItem key={status} value={status} className="flex items-center gap-3 pl-2 text-right" showDefaultCheck={false}>
                                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded ${leadStatusConfig[status].color} ml-2`}></span>
                                          <span>{status}</span>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </Label>
                                <Label className="block"><span className="text-gray-700 text-sm font-medium">{'מקור:'}</span><Input type="text" className="mt-1 h-8 text-sm" value={editLeadSource} onChange={(ev) => setEditLeadSource(ev.target.value)} /></Label>
                                {editLeadStatus === 'תור נקבע' && (<Label className="block"><span className="text-gray-700 text-sm font-medium">{'תאריך ושעת פגישה:'}</span><Input type="datetime-local" className="mt-1 h-8 text-sm" value={editLeadAppointmentDateTime} onChange={(ev) => setEditLeadAppointmentDateTime(ev.target.value)} required /></Label>)}
                                <Label className="block"><span className="text-gray-700 text-sm font-medium">{'סניף:'}</span>
                                  <Select value={editLeadBranch} onValueChange={setEditLeadBranch}>
                                    <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="בחר סניף..." /></SelectTrigger>
                                    <SelectContent>
                                      {BRANCHES.filter(b => b.value).map(b => (<SelectItem key={b.value} value={b.value}><span className={`inline-block w-3 h-3 rounded-full mr-2 align-middle ${b.color}`}></span>{b.label}</SelectItem>))}
                                    </SelectContent>
                                  </Select>
                                </Label>
                              </div>
                              <div className="flex items-center gap-2 pt-2">
                                <input
                                  type="checkbox"
                                  id={`edit-lead-hot-${lead.id}`}
                                  checked={editLeadIsHot}
                                  onChange={(e) => setEditLeadIsHot(e.target.checked)}
                                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <Label htmlFor={`edit-lead-hot-${lead.id}`} className="text-sm font-medium cursor-pointer">ליד חם 🔥</Label>
                              </div>
                              <div className="border-t pt-3">
                                <div className="flex justify-between items-center mb-2">
                                  <div className="font-semibold text-sm">{'היסטוריית שיחה:'}</div>
                                  <Button type="button" variant="link" size="sm" onClick={() => setShowConvUpdate(showConvUpdate === lead.id ? null : lead.id)} className="text-blue-600 hover:underline p-0 h-auto">{showConvUpdate === lead.id ? 'הסתר הוספה' : '+ הוסיפי עדכון'}</Button>
                                </div>
                                {showConvUpdate === lead.id && (
                                  <div className="flex gap-2 mb-3">
                                    <Textarea className="text-sm" rows={2} value={newConversationText} onChange={(ev) => setNewConversationText(ev.target.value)} placeholder="כתוב עדכון שיחה..." />
                                    <Button size="sm" type="button" onClick={() => handleAddConversation(lead.id)} className="shrink-0">{'הוסיפי'}</Button>
                                  </div>
                                )}
                                <ul className="space-y-1.5 max-h-40 overflow-y-auto border rounded p-2 bg-white">
                                  {(lead.conversationSummary || []).length === 0 && <li className="text-xs text-gray-500 text-center py-2">{'אין עדכוני שיחה.'}</li>}
                                  {(lead.conversationSummary || []).map((c, idx) => (
                                    <li key={idx} className="text-xs bg-gray-50 p-1.5 border rounded">
                                      <div className="font-semibold text-gray-700" dir="rtl">{formatDateTime(c.timestamp)}</div>
                                      <div className="text-gray-800" dir="rtl">{c.text}</div>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div className="border-t pt-3">
                                <Label className="font-semibold text-sm block mb-1">{'הוסיפי משימה מהליד:'}</Label>
                                <div className="flex flex-col md:flex-row gap-2">
                                  <Input type="text" className="h-8 text-sm flex-1" placeholder="תיאור משימה..." />
                                  <Select value={""}>
                                    <SelectTrigger className="h-8 text-sm w-32"><SelectValue placeholder="מוקצה ל..." /></SelectTrigger>
                                    <SelectContent>{assignableUsers.map(user => (<SelectItem key={user.id} value={user.alias || user.email}>{user.alias || user.email}</SelectItem>))}</SelectContent>
                                  </Select>
                                  <Select value={"להתקשר"}>
                                    <SelectTrigger className="h-8 text-sm w-32"><SelectValue placeholder="קטגוריה..." /></SelectTrigger>
                                    <SelectContent>{taskCategories.map(cat => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}</SelectContent>
                                  </Select>
                                  <input type="date" className="input-icon" />
                                  <input type="time" className="input-icon" />
                                  <Button type="button" size="sm" className="shrink-0">{'➕ משימה'}</Button>
                                </div>
                              </div>
                              <div className="flex gap-2 justify-end border-t pt-3 mt-4">
                                <Button type="submit" size="sm">{'שמור שינויים'}</Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => handleCollapseLead(lead.id)}>{'סגור'}</Button>
                                {(currentUser?.role === 'admin' || role === 'admin') && (<Button type="button" variant="destructive" size="sm" onClick={() => handleDeleteLead(lead.id)}>{'מחק ליד'}</Button>)}
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
          <ul className="space-y-2 h-[calc(100vh-280px)] min-h-[400px] overflow-y-auto pr-1">
            {leadsSorted.length === 0 && (<li className="text-center text-gray-500 py-6">{'אין לידים להצגה'}</li>)}
            {leadsSorted.slice(0, leadRowLimit).map((lead) => {
              const colorTab = leadColorTab(lead.status);
              return (
                <li key={`compact-${lead.id}`} className="p-2 border rounded shadow-sm flex items-center gap-2 bg-white hover:bg-gray-50">
                  <div className={`w-2 h-10 ${colorTab} rounded shrink-0`} />
                  <div className="flex-grow overflow-hidden">
                    <div className="font-bold text-sm truncate">
                      {lead.isHot && <span className="mr-1">🔥</span>}
                      {lead.isDuplicate && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-orange-500 font-bold mr-1" style={{ fontSize: '10px', cursor: 'help' }}>
                              ••{lead.duplicateCount > 2 ? `×${lead.duplicateCount}` : ''}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs">
                              <div>ליד משוכפל</div>
                              <div>מוזג מ-{lead.duplicateCount - 1} ליד{lead.duplicateCount > 2 ? 'ים' : ''} קודם{lead.duplicateCount > 2 ? 'ים' : ''}</div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {lead.fullName}
                    </div>
                    <p className="text-xs text-gray-600 truncate">{lead.message}</p>
                    <p className="text-xs text-gray-500 truncate">{lead.status} - {formatDateTime(lead.createdAt)}</p>
                    {lead.branch && (<span className={`inline-block rounded-full px-2 py-0.5 ml-1 text-xs font-medium ${branchColor(lead.branch)}`}>{lead.branch}</span>)}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button size="icon" variant="ghost" className="w-6 h-6 text-gray-500 hover:text-blue-600" title="פתח לעריכה" onClick={() => handleEditLead(lead)}><span role="img" aria-label="Edit" className="w-3 h-3">✎</span></Button>
                    <Tooltip><TooltipTrigger asChild><a href={`https://wa.me/${lead.phoneNumber}`} target="_blank" rel="noopener noreferrer"><Button size="icon" variant="ghost" className="w-6 h-6 text-green-600 hover:text-green-700"><span role="img" aria-label="WhatsApp">💬</span></Button></a></TooltipTrigger><TooltipContent>{'שלח וואטסאפ'}</TooltipContent></Tooltip>
                    <Button size="icon" variant="ghost" className="w-6 h-6 text-blue-600 hover:text-blue-700" title="התקשר דרך המרכזיה" onClick={() => handleClick2Call(lead.phoneNumber)}><span role="img" aria-label="Call" className="w-3 h-3">📞</span></Button>
                    {(currentUser?.role === 'admin' || role === 'admin') && (<Tooltip><TooltipTrigger asChild><Button size="icon" variant="destructive" className="w-6 h-6 text-red-600 hover:text-red-700" onClick={() => handleDeleteLead(lead.id)} title="מחק ליד"><span role="img" aria-label="Delete">🗑️</span></Button></TooltipTrigger><TooltipContent>מחק ליד</TooltipContent></Tooltip>)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      {/* Add Lead Modal */}
      {showAddLeadModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 p-4" onClick={() => setShowAddLeadModal(false)}>
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4 text-right">{'הוספת ליד חדש'}</h2>
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
                <Label htmlFor="new-lead-hot" className="text-sm font-medium">ליד חם 🔥</Label>
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
                <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-8">הוסיפי ליד</Button>
                <Button type="button" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setShowAddLeadModal(false)}>ביטול</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Duplicate Lead Confirmation Modal */}
      {showDuplicateConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 p-4" onClick={() => setShowDuplicateConfirm(false)}>
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4 text-right" dir="rtl">אישור שכפול ליד</h2>
            <p className="text-right mb-6" dir="rtl">האם את בטוחה שאת רוצה לשכפל את הליד הזה?</p>
            <div className="flex gap-3 justify-center">
              <Button 
                onClick={confirmDuplicateLead}
                className="bg-green-600 hover:bg-green-700 text-white px-6"
              >
                כן, שכפל
              </Button>
              <Button 
                onClick={() => {
                  setShowDuplicateConfirm(false);
                  setLeadToDuplicate(null);
                }}
                variant="outline"
                className="px-6"
              >
                ביטול
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Phone Warning Modal */}
      {showDuplicateWarning && existingDuplicateLead && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 p-4" onClick={() => {
          setShowDuplicateWarning(false);
          setExistingDuplicateLead(null);
          setPendingNewLead(null);
        }}>
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <span className="text-4xl">⚠️</span>
            </div>
            <h2 className="text-lg font-semibold mb-4 text-right text-orange-600" dir="rtl">ליד כפול - מספר טלפון קיים</h2>
            <div className="text-right mb-4 space-y-2" dir="rtl">
              <p className="text-sm">מספר הטלפון <strong>{existingDuplicateLead.phoneNumber}</strong> כבר קיים במערכת:</p>
              <div className="bg-gray-100 p-3 rounded border border-gray-300">
                <p className="font-semibold">{existingDuplicateLead.fullName}</p>
                <p className="text-xs text-gray-600">סטטוס: {existingDuplicateLead.status}</p>
                <p className="text-xs text-gray-600">תאריך: {formatDateTime(existingDuplicateLead.createdAt)}</p>
                {existingDuplicateLead.message && (
                  <p className="text-xs text-gray-600 mt-1">הודעה: {existingDuplicateLead.message}</p>
                )}
              </div>
              <p className="text-sm font-medium mt-4">האם להוסיף בכל זאת?</p>
              <p className="text-xs text-gray-500">המערכת תמזג אוטומטית את הלידים ותשמור רק את החדש ביותר.</p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button 
                onClick={confirmAddDuplicateLead}
                className="bg-orange-600 hover:bg-orange-700 text-white px-6"
              >
                כן, הוסף בכל זאת
              </Button>
              <Button 
                onClick={() => {
                  setShowDuplicateWarning(false);
                  setExistingDuplicateLead(null);
                  setPendingNewLead(null);
                }}
                variant="outline"
                className="px-6"
              >
                ביטול
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}


