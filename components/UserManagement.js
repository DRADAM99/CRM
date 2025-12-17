import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import AddUserDialog from "@/components/AddUserDialog";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase"; // Assuming firebase config is in root
import { useToast } from "@/components/ui/use-toast";

export default function UserManagement({ role, currentUserData }) {
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleAddUser = async (newUser) => {
    try {
        const { email, password, ...userData } = newUser;
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, "users", user.uid), {
            ...userData,
            uid: user.uid,
            email: user.email,
        });

        toast({
            title: "User Created",
            description: "New user has been created successfully.",
        });
        setIsAddUserDialogOpen(false); // Close the dialog
    } catch (error) {
        console.error("Error creating user:", error);
        toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
        });
    }
  };

  // Check both role prop and currentUserData for admin status
  const isAdmin = role === 'admin' || currentUserData?.role === 'admin';
  
  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <Button onClick={() => setIsAddUserDialogOpen(true)} className="mr-4">הוסף משתמש חדש</Button>
      <AddUserDialog 
        isOpen={isAddUserDialogOpen} 
        onClose={() => setIsAddUserDialogOpen(false)}
        onAddUser={handleAddUser}
      />
    </>
  );
}
