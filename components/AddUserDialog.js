import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { serverTimestamp } from "firebase/firestore";

export default function AddUserDialog({ isOpen, onClose, onAddUser }) {
  const [alias, setAlias] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [leadNotifications, setLeadNotifications] = useState(true);
  const [taskNotifications, setTaskNotifications] = useState(true);

  const handleSubmit = () => {
    const newUser = {
      alias,
      email,
      password, // Note: Password should be handled carefully
      role,
      leadNotifications,
      taskNotifications,
      createdAt: serverTimestamp(),
      kanbanCategoryOrder: [],
      kanbanTaskCollapsed: {},
      userFilterCalendar: [],
    };
    onAddUser(newUser);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent dir="rtl" className="bg-white">
        <DialogHeader className="text-center">
          <DialogTitle>הוסף משתמש חדש</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="alias" className="text-right">
              Alias
            </Label>
            <Input id="alias" value={alias} onChange={(e) => setAlias(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">
              Email
            </Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="password" className="text-right">
              Password
            </Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="role" className="text-right">
              Role
            </Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="lead-notifications" className="text-right col-span-3">Lead Notifications</Label>
            <Switch id="lead-notifications" checked={leadNotifications} onCheckedChange={setLeadNotifications} />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="task-notifications" className="text-right col-span-3">Task Notifications</Label>
            <Switch id="task-notifications" checked={taskNotifications} onCheckedChange={setTaskNotifications} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} className="bg-green-500 text-white">הוסף משתמש</Button>
          <Button onClick={onClose} className="bg-red-500 text-white">ביטול</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
