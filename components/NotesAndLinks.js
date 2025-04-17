
import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  getDocs,
  doc,
  serverTimestamp,
  query,
  where,
  orderBy,
} from "firebase/firestore";

export default function NotesAndLinks({ section }) {
  const [notes, setNotes] = useState([]);
  const [links, setLinks] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [targetUser, setTargetUser] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [newLink, setNewLink] = useState({ title: "", url: "" });

  const userEmail = auth.currentUser?.email;

  const fetchUsers = async () => {
    const snap = await getDocs(collection(db, "users"));
    setAllUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const fetchNotes = async () => {
    const q = query(collection(db, "notes"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    setNotes(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  const fetchLinks = async () => {
    const q = query(collection(db, "links"), where("addedBy", "==", userEmail));
    const snapshot = await getDocs(q);
    setLinks(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    await addDoc(collection(db, "notes"), {
      to: targetUser,
      text: newNote,
      createdAt: serverTimestamp(),
      author: userEmail || "anon",
    });
    setNewNote("");
    setModalOpen(false);
    fetchNotes();
  };

  const addLink = async () => {
    if (!newLink.title.trim() || !newLink.url.trim()) return;
    if (links.length >= 5) return alert("אפשר לשמור עד 5 קישורים בלבד.");
    await addDoc(collection(db, "links"), {
      ...newLink,
      addedBy: userEmail || "anon",
    });
    setNewLink({ title: "", url: "" });
    setModalOpen(false);
    fetchLinks();
  };

  const deleteNote = async (id) => {
    await deleteDoc(doc(db, "notes", id));
    fetchNotes();
  };

  const deleteLink = async (id) => {
    await deleteDoc(doc(db, "links", id));
    fetchLinks();
  };

  useEffect(() => {
    if (section === "notes") fetchNotes();
    if (section === "links") fetchLinks();
    fetchUsers();
  }, [section]);

  if (section === "notes") {
    return (
      <div className="flex items-center gap-2">
        {notes.map((note) => (
          <div
            key={note.id}
            className="bg-yellow-200 border-yellow-400 border rounded shadow p-2 max-w-xs text-xs relative font-sans"
          >
            <div>{note.text}</div>
            <div className="text-gray-600 mt-1 text-[10px]">
              {allUsers.find(u => u.email === note.author)?.alias || note.author}
            </div>
            <button
              onClick={() => deleteNote(note.id)}
              className="absolute top-0 right-1 text-red-400 text-xs"
            >
              ×
            </button>
          </div>
        ))}

        {/* Add Note Icon */}
        <button
          onClick={() => setModalOpen(true)}
          className="text-yellow-600 text-2xl"
          title="הוסף פתק"
        >
          📝+
        </button>

        {/* Modal */}
        {modalOpen && (
          <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-white shadow-xl p-4 border rounded z-50 w-60">
            <select value={targetUser} onChange={(e) => setTargetUser(e.target.value)} className="text-xs border p-1 rounded w-full mb-2">
              <option value="all">לכולם</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.alias || u.email}>
                  {u.alias || u.email}
                </option>
              ))}
            </select>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="מה ברצונך להוסיף?"
              className="w-full p-1 text-xs border rounded"
            />
            <div className="flex justify-between mt-2 text-xs">
              <button onClick={() => setModalOpen(false)} className="text-gray-500">ביטול</button>
              <button onClick={addNote} className="text-yellow-600 font-bold">הוסף</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (section === "links") {
    return (
      <div className="flex items-center gap-2">
        {links.map((link) => (
          <div key={link.id} className="flex items-center gap-1">
            <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-xl">
              📄
            </a>
            <button
              onClick={() => deleteLink(link.id)}
              className="text-red-400 text-xs"
            >
              x
            </button>
          </div>
        ))}
        <button onClick={() => setModalOpen(true)} className="text-green-600 text-2xl" title="הוסף קישור">
          📎+
        </button>

        {modalOpen && (
          <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-white shadow-xl p-4 border rounded z-50 w-64">
            <input
              type="text"
              value={newLink.title}
              onChange={(e) => setNewLink({ ...newLink, title: e.target.value })}
              placeholder="שם"
              className="text-xs border p-1 rounded w-full mb-2"
            />
            <input
              type="text"
              value={newLink.url}
              onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
              placeholder="https://..."
              className="text-xs border p-1 rounded w-full"
            />
            <div className="flex justify-between mt-2 text-xs">
              <button onClick={() => setModalOpen(false)} className="text-gray-500">ביטול</button>
              <button onClick={addLink} className="text-green-600 font-bold">הוסף</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
