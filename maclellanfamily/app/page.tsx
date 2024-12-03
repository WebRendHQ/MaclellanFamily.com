"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { login } from "./api/firebase/auth";
import { auth, onAuthStateChanged } from "./api/firebase/firebase";
import { FirebaseError } from 'firebase/app';
import { Pencil, Bookmark, Sticker } from 'lucide-react';
import type { User } from 'firebase/auth';

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
      
      if (user) {
        try {
          router.replace('/yearbooks');
        } catch (error) {
          console.error('Navigation error:', error);
        }
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMessage("Email and Password are required.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    
    try {
      const user = await login(email, password);
      if (user) {
        setEmail("");
        setPassword("");
        window.location.reload();
      }
    } catch (error) {
      if (error instanceof FirebaseError) {
        switch (error.code) {
          case 'auth/invalid-email':
            setErrorMessage('Invalid email address format.');
            break;
          case 'auth/user-disabled':
            setErrorMessage('This account has been disabled.');
            break;
          case 'auth/user-not-found':
            setErrorMessage('No account found with this email.');
            break;
          case 'auth/wrong-password':
            setErrorMessage('Incorrect password.');
            break;
          default:
            console.error('Detailed login error:', error);
            setErrorMessage('An error occurred during login. Please try again.');
        }
      } else {
        console.error('Unexpected login error:', error);
        setErrorMessage('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  const backgroundStyle = {
    backgroundImage: "url('/background-min.jpg')",
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  };

  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={backgroundStyle}>
        <div className="text-center font-handwriting text-2xl">Opening your scrapbook...</div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={backgroundStyle}>
        <div className="text-center font-handwriting text-2xl">Finding your memories...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative" style={backgroundStyle}>
      {/* Login form container positioned in bottom corner */}
      <div className="absolute bottom-8 right-8 w-full max-w-sm">
        <div className="relative">
          {/* Decorative elements */}
          <div className="absolute -top-4 left-4 transform -rotate-12">
            <Bookmark className="w-10 h-10 text-blue-400 opacity-60" />
          </div>
          <div className="absolute -top-3 right-4 transform rotate-12">
            <Sticker className="w-10 h-10 text-pink-400 opacity-60" />
          </div>
          
          <div className="bg-white shadow-lg rounded-lg p-6 transform rotate-1 border-4 border-amber-100">
            <div className="transform -rotate-1">
              <h1 className="text-2xl font-bold mb-4 text-center text-amber-800 font-handwriting flex items-center justify-center gap-2">
                <Pencil className="w-5 h-5" />
                Sign In
              </h1>
              
              <div className="mb-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Email"
                  className="w-full px-3 py-2 border-2 border-amber-200 rounded-lg bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 font-handwriting text-base"
                />
              </div>
              
              <div className="mb-4">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Password"
                  className="w-full px-3 py-2 border-2 border-amber-200 rounded-lg bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 font-handwriting text-base"
                />
              </div>

              <button
                onClick={handleLogin}
                disabled={isLoading}
                className="w-full bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 font-handwriting text-lg"
              >
                {isLoading ? "Opening..." : "Open Scrapbook"}
              </button>

              {errorMessage && (
                <div className="mt-3 p-2 bg-red-50 border-2 border-red-200 rounded-lg text-red-600 text-center font-handwriting text-sm">
                  {errorMessage}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 