"use client";
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { db } from '@/firebase';
import { collection, onSnapshot, getDocs, query, orderBy, doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { normalizePhoneNumber } from '@/lib/phoneUtils';

const DataContext = createContext();

export function DataProvider({ children }) {
  const { currentUser } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const processingDuplicates = useRef(new Set()); // Track which leads are being processed

  // Fetch current user's full data including alias
  useEffect(() => {
    const fetchCurrentUserData = async () => {
      if (!currentUser) {
        setCurrentUserData(null);
        return;
      }
      try {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setCurrentUserData({
            uid: currentUser.uid,
            email: currentUser.email,
            alias: data.alias || currentUser.email || "",
            role: data.role || "staff",
            EXT: data.EXT || ""
          });
        } else {
          // Fallback if no user document exists
          setCurrentUserData({
            uid: currentUser.uid,
            email: currentUser.email,
            alias: currentUser.email || "",
            role: "staff",
            EXT: ""
          });
        }
      } catch (error) {
        console.error("Error fetching current user data:", error);
        setCurrentUserData({
          uid: currentUser.uid,
          email: currentUser.email,
          alias: currentUser.email || "",
          role: "staff",
          EXT: ""
        });
      }
    };
    fetchCurrentUserData();
  }, [currentUser]);

  // Single users fetch
  useEffect(() => {
    const fetchUsers = async () => {
      if (!currentUser) return;
      try {
        const usersRef = collection(db, "users");
        const usersSnap = await getDocs(usersRef);
        const usersData = usersSnap.docs.map(doc => ({
          id: doc.id,
          email: doc.data().email || "",
          alias: doc.data().alias || doc.data().email || "",
          role: doc.data().role || "staff"
        }));
        setUsers(usersData);
        setAssignableUsers(usersData);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };
    fetchUsers();
  }, [currentUser]);

  // Single tasks listener
  useEffect(() => {
    if (!currentUser || !users.length) return;
    
    const tasksRef = collection(db, "tasks");
    const q = query(tasksRef, orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allTasks = snapshot.docs.map(doc => {
        const data = doc.data();
        const replies = Array.isArray(data.replies) 
          ? data.replies.map(reply => ({
              ...reply,
              timestamp: reply.timestamp?.toDate?.() || new Date(reply.timestamp) || new Date(),
              isRead: reply.isRead || false
            })).sort((a, b) => b.timestamp - a.timestamp) 
          : [];
        
        let dueDate = null;
        if (data.dueDate) {
          if (typeof data.dueDate.toDate === 'function') dueDate = data.dueDate.toDate();
          else if (typeof data.dueDate === 'string') dueDate = new Date(data.dueDate);
          else if (data.dueDate instanceof Date) dueDate = data.dueDate;
        }
        
        return {
          id: doc.id,
          ...data,
          dueDate,
          replies,
          uniqueId: `task-${doc.id}-${Date.now()}`
        };
      });
      
      setTasks(allTasks);
    });
    
    return () => unsubscribe();
  }, [currentUser, users]);

  // Helper function to detect and handle duplicates
  const handleDuplicateLeads = async (allLeads) => {
    // Group leads by normalized phone number
    const phoneGroups = {};
    
    allLeads.forEach(lead => {
      if (!lead.phoneNumber) return;
      const normalizedPhone = normalizePhoneNumber(lead.phoneNumber);
      if (!normalizedPhone) return;
      
      if (!phoneGroups[normalizedPhone]) {
        phoneGroups[normalizedPhone] = [];
      }
      phoneGroups[normalizedPhone].push(lead);
    });

    // Process groups with duplicates
    for (const [normalizedPhone, group] of Object.entries(phoneGroups)) {
      if (group.length > 1) {
        // Sort by createdAt descending (newest first)
        group.sort((a, b) => b.createdAt - a.createdAt);
        
        const newestLead = group[0];
        const olderLeads = group.slice(1);

        // Skip if already processing this lead
        if (processingDuplicates.current.has(newestLead.id)) continue;
        
        // Mark as processing
        processingDuplicates.current.add(newestLead.id);

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

          console.log(`✅ Handled ${group.length} duplicate leads for phone: ${normalizedPhone}`);
        } catch (error) {
          console.error('Error handling duplicate leads:', error);
        } finally {
          // Remove from processing set after a delay
          setTimeout(() => {
            processingDuplicates.current.delete(newestLead.id);
          }, 2000);
        }
      }
    }
  };

  // Single leads listener with duplicate detection
  useEffect(() => {
    if (!currentUser) return;
    
    const unsubscribe = onSnapshot(
      query(collection(db, "leads"), orderBy("createdAt", "desc")),
      async (snapshot) => {
        const allLeads = snapshot.docs.map((doc) => {
          const data = doc.data();
          const conversationSummary = (data.conversationSummary || []).map(entry => ({
            ...entry,
            timestamp: entry.timestamp?.toDate 
              ? entry.timestamp.toDate() 
              : (entry.timestamp ? new Date(entry.timestamp) : null)
          }));
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            conversationSummary,
            isHot: data.isHot || false,
            isDuplicate: data.isDuplicate || false,
            duplicateCount: data.duplicateCount || 0,
          };
        });

        // Handle duplicates in the background
        handleDuplicateLeads(allLeads).catch(err => {
          console.error('Error in duplicate handling:', err);
        });

        setLeads(allLeads);
        setLoading(false);
      }
    );
    
    return () => unsubscribe();
  }, [currentUser]);

  const value = {
    tasks,
    leads,
    users,
    assignableUsers,
    currentUserData,
    loading,
    setTasks, // Allow components to update local state
    setLeads
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
}

