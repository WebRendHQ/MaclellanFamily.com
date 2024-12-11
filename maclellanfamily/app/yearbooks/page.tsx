'use client';

import { useEffect, useState, useRef } from 'react';
// import { useRouter } from 'next/navigation';
import { auth, onAuthStateChanged } from "../lib/firebase-client";
import { Book, Stars, Sparkles } from 'lucide-react';
import type { User } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';

interface FolderData {
  name: string;
  thumbnailUrl: string | null;
  loading: boolean;
  error: string | null;
}

const YearBookSpine = ({ 
  folder, 
  onClick,
  index,
  isVisible 
}: { 
  folder: FolderData; 
  onClick: () => void;
  index: number;
  isVisible: boolean;
}) => (
  <div
    className={`transform transition-all duration-700
      ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'}`}
    style={{ transitionDelay: `${index * 100}ms` }}
  >
    <div
      onClick={onClick}
      className="relative h-[300px] w-[60px] cursor-pointer transition-all duration-300 
                hover:translate-y-[-10px] group"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick();
        }
      }}
      style={{ 
        perspective: '1000px',
        transformStyle: 'preserve-3d'
      }}
    >
      {folder.loading ? (
        <div className="absolute inset-0 bg-amber-100 flex items-center justify-center">
          <div className="text-amber-800 rotate-90">Loading...</div>
        </div>
      ) : folder.error ? (
        <div className="absolute inset-0 bg-red-100 flex items-center justify-center">
          <div className="text-red-500 rotate-90">{folder.error}</div>
        </div>
      ) : (
        <div 
          className="relative h-full w-full transition-transform duration-500 group-hover:shadow-xl"
          style={{ 
            transformStyle: 'preserve-3d',
            transform: 'translateZ(0)',
          }}
        >
          {/* Book spine */}
          <div 
            className="absolute inset-0 bg-gradient-to-r from-[#8b7355] to-[#654321] shadow-lg"
            style={{ 
              transformStyle: 'preserve-3d',
              transform: 'translateZ(0) rotateY(0deg)',
              backfaceVisibility: 'hidden'
            }}
          >
            <div className="absolute top-4 left-0 w-full h-[calc(100%-32px)] flex items-center justify-center">
              <div className="rotate-90 whitespace-nowrap text-xl font-serif text-[#fff8e7] tracking-wider">
                {folder.name} Yearbook
              </div>
            </div>
            {/* Decorative elements */}
            <div className="absolute top-2 left-2 right-2 h-[2px] bg-[#d4c4a8] opacity-30" />
            <div className="absolute bottom-2 left-2 right-2 h-[2px] bg-[#d4c4a8] opacity-30" />
          </div>

          {/* Book side */}
          <div 
            className="absolute left-full top-0 h-full w-[200px] origin-left bg-[#fff8e7] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ 
              transform: 'rotateY(90deg)',
              transformStyle: 'preserve-3d'
            }}
          >
            <div className="absolute inset-4 border-4 border-dashed border-[#d4c4a8] opacity-30" />
            {folder.thumbnailUrl && (
              <div 
                className="absolute inset-8 bg-cover bg-center rounded"
                style={{ backgroundImage: `url(${folder.thumbnailUrl})` }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  </div>
);

const DecorativeTape = ({ className = "" }: { className?: string }) => (
  <div 
    className={`absolute h-8 bg-yellow-100/70 transform ${className}`} 
    style={{ width: '60px' }} 
  />
);

const DecorativeSticker = ({ 
  children, 
  color, 
  className = "" 
}: { 
  children: React.ReactNode;
  color: string;
  className?: string;
}) => (
  <div className={`absolute ${color} rounded-full w-12 h-12 flex items-center justify-center transform rotate-12 shadow-md ${className}`}>
    {children}
  </div>
);

export default function S3FolderList() {
  // const router = useRouter();
  const [folderData, setFolderData] = useState<FolderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const mounted = useRef(true);

  const navigateWithReload = (url: string) => {
    window.location.href = url;
  };

  useEffect(() => {
    const handleNavigation = () => {
      window.location.reload();
    };

    window.addEventListener('popstate', handleNavigation);
    return () => {
      window.removeEventListener('popstate', handleNavigation);
    };
  }, []);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!mounted.current) return;
      
      setUser(currentUser);
      setIsAuthReady(true);
      
      if (!currentUser) {
        navigateWithReload('/');
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isAuthReady || !mounted.current) return;

    const fetchFolders = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const token = await user.getIdToken(true);
        
        const response = await fetch('/api/yearbooks', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-store',
            'Pragma': 'no-cache'
          }
        });

        if (!mounted.current) return;

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 401) {
            navigateWithReload('/');
            return;
          }
          throw new Error(data.message || `HTTP error! status: ${response.status}`);
        }

        if (data.error) throw new Error(data.error);

        const folderData = data.folders.map((folder: { name: string; thumbnailUrl: string | null }) => ({
          name: folder.name,
          thumbnailUrl: folder.thumbnailUrl,
          loading: false,
          error: null
        }));
        
        if (mounted.current) {
          setFolderData(folderData);
          setTimeout(() => {
            if (mounted.current) {
              setIsVisible(true);
            }
          }, 100);
        }
      } catch (err) {
        console.error('Fetch error:', err);
        if (mounted.current) {
          if (err instanceof FirebaseError) {
            if (err.code === 'auth/invalid-token') {
              navigateWithReload('/');
              return;
            }
          }
          setError(err instanceof Error ? err.message : 'An error occurred');
        }
      } finally {
        if (mounted.current) {
          setLoading(false);
        }
      }
    };

    fetchFolders();
  }, [user, isAuthReady]);

  const handleFolderClick = (folderName: string) => {
    navigateWithReload(`/yearbooks/${folderName}`);
  };

  if (!isAuthReady || loading || !user || error) {
    return (
      <div className="min-h-screen bg-[#f5e6d3] flex justify-center items-center">
        <div className="relative bg-white p-8 rounded-lg shadow-md transform -rotate-1">
          <DecorativeTape className="-rotate-45 -top-4 -left-4" />
          <DecorativeTape className="rotate-45 -top-4 -right-4" />
          <div className={`text-xl ${error ? "text-red-500" : "text-amber-900"} font-indie`}>
            {error ? `Error: ${error}` : loading ? "Loading your library..." : "Checking authentication..."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5e6d3] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className={`relative text-center mb-16 transition-opacity duration-1000 
          ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="relative inline-block bg-white p-8 rounded-lg shadow-md transform -rotate-2">
            <DecorativeTape className="-rotate-45 -top-4 -left-8" />
            <DecorativeTape className="rotate-45 -top-4 -right-8" />
            <DecorativeSticker color="bg-amber-100" className="absolute -top-6 -right-6">
              <Stars className="w-6 h-6 text-amber-600" />
            </DecorativeSticker>
            <DecorativeSticker color="bg-blue-100" className="absolute -bottom-6 -left-6">
              <Sparkles className="w-6 h-6 text-blue-600" />
            </DecorativeSticker>
            
            <div className="flex justify-center mb-4">
              <Book className="w-16 h-16 text-amber-800 transform -rotate-12" />
            </div>
            <h1 className="text-5xl font-indie mb-4 text-amber-900 relative">
              <span className="relative z-10">Your Yearbook Library</span>
              <div className="absolute -bottom-2 left-0 w-full h-4 bg-yellow-200/50 -rotate-1" />
            </h1>
            <div className="text-lg text-amber-800 italic font-indie">{user.email}</div>
            <div className="mt-4 w-32 h-1 bg-amber-800 mx-auto" />
          </div>
        </div>

        {/* Bookshelf */}
        <div className="relative mt-16">
          {/* Decorative elements */}
          <div className="absolute -top-8 left-1/4 w-16 h-16 bg-pink-100/30 rounded-full transform -translate-y-1/2" />
          <div className="absolute -top-8 right-1/4 w-12 h-12 bg-blue-100/30 rounded-full transform -translate-y-1/2" />

          {/* Shelf top */}
          <div className="absolute -top-4 left-0 right-0 h-4 bg-[#654321] shadow-md rounded-t-sm transform -rotate-1" />

          {/* Books container */}
          <div className="relative bg-white p-8 rounded-lg min-h-[400px] shadow-lg transform rotate-1">
            <DecorativeTape className="-rotate-12 -top-4 left-8" />
            <DecorativeTape className="rotate-12 -top-4 right-8" />
            
            {folderData.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-xl font-indie text-amber-800 italic transform -rotate-2">
                  Your library is empty
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-6 justify-center items-end">
                {folderData.map((folder, index) => (
                  <YearBookSpine
                    key={folder.name}
                    folder={folder}
                    onClick={() => handleFolderClick(folder.name)}
                    index={index}
                    isVisible={isVisible}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Shelf bottom */}
          <div className="absolute -bottom-6 left-0 right-0 h-6 bg-[#654321] shadow-md rounded-b-sm transform rotate-1" />
        </div>
      </div>

      <style jsx global>{`
        @keyframes floatAnimation {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }

        .book-hover-effect {
          transition: transform 0.3s ease-in-out;
        }

        .book-hover-effect:hover {
          transform: translateY(-10px) scale(1.02);
        }

        .font-indie {
          font-family: 'Indie Flower', cursive;
        }
      `}</style>
    </div>
  );
}