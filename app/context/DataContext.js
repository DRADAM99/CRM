"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '@/firebase';
import { collection, onSnapshot, getDocs, query, orderBy } from 'firebase/firestore';
import { useAuth } from './AuthContext';

const DataContext = createContext();

export function DataProvider({ children }) {
  const { currentUser } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [loading, setLoading] = useState(true);

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

  // Single leads listener
  useEffect(() => {
    if (!currentUser) return;
    
    const unsubscribe = onSnapshot(
      query(collection(db, "leads"), orderBy("createdAt", "desc")),
      (snapshot) => {
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
          };
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

