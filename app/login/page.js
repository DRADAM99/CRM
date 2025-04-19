"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = (e) => {
    e.preventDefault();
    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        const user = userCredential.user;
        console.log("Logged in:", user);
        // You might want to redirect, e.g.
        router.push("/");
      })
      .catch((error) => {
        console.error("Login error:", error.message);
        alert("שגיאת התחברות: בדוק אימייל וסיסמה.");
      });
  };
  

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <Image
        src="/dashboard-graphic.jpg"
        alt="Dashboard Visual"
        width={300}
        height={160}
        className="mb-6 rounded"
      />
      <form onSubmit={handleLogin} className="bg-white p-6 rounded shadow-md w-full max-w-sm space-y-4">
        <h1 className="text-xl font-bold text-center">התחברות למערכת</h1>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <input
          type="email"
          placeholder="כתובת אימייל"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border p-2 rounded text-right"
        />
        <input
          type="password"
          placeholder="סיסמה"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border p-2 rounded text-right"
        />
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
        >
          התחבר
        </button>
        <a href="#" className="text-sm text-blue-600 text-right block hover:underline">
          שכחת סיסמה?
        </a>
      </form>
      <Image
        src="/logo.png"
        alt="Logo"
        width={320}
        height={160}
        className="mb-4"
      />
    </div>
  );
}
