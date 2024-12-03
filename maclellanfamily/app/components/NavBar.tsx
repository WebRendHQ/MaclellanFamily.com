'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, LogOut, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import Button from '../components/ui/ButtonN';
import { logout } from '../api/firebase/auth';
import { onAuthStateChanged, getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const NavButton = ({ 
    children, 
    onClick, 
    rotate = '0' 
  }: {
    children: React.ReactNode;
    onClick: () => void;
    rotate?: string;
  }) => (
    <div className="relative group">
      <div className="absolute -inset-1 bg-yellow-100/70 rounded-lg transform rotate-3 group-hover:rotate-6 transition-transform" />
      <Button
        variant="ghost"
        size="icon"
        onClick={onClick}
        className={`relative h-10 w-10 bg-white border-2 border-gray-300 hover:bg-gray-50 transform ${rotate} transition-all duration-200 hover:scale-110 z-10`}
      >
        {children}
      </Button>
    </div>
  );

const Navbar = () => {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [folders, setFolders] = useState<{name: string}[]>([]);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const db = getFirestore();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        setIsAdmin(userData?.role === 'admin');
      } else {
        setIsAdmin(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchFolders = async () => {
      try {
        const auth = getAuth();
        const idToken = await auth.currentUser?.getIdToken();
        
        const response = await fetch('/api/s3', {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });
        const data = await response.json();
        setFolders(data.folders || []);
      } catch (error) {
        console.error('Failed to fetch folders:', error);
      }
    };
  
    if (showModal) {
      fetchFolders();
    }
  }, [showModal]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleSettings = () => {
    router.push('/settings');
  };

  const handleFileSelect = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        setSelectedFile(file);
        setShowModal(true);
      }
    };

    input.click();
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedFolder || isUploading) return;
  
    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('folder', selectedFolder);
  
      const auth = getAuth();
      const idToken = await auth.currentUser?.getIdToken();
  
      const response = await fetch('/api/s3', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`
        },
        body: formData,
      });
  
      if (!response.ok) {
        throw new Error('Upload failed');
      }
  
      console.log('Upload successful');
      setShowModal(false);
      setSelectedFile(null);
      setSelectedFolder('');
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50">
        {/* Decorative tape strips */}
        <div className="absolute top-0 left-1/4 w-16 h-8 bg-yellow-100/70 transform -rotate-12" />
        <div className="absolute top-0 right-1/4 w-16 h-8 bg-pink-100/70 transform rotate-12" />
        
        <div className="relative flex items-center justify-between p-4 bg-[#f5e6d3] border-b-2 border-gray-300 shadow-md">
          {/* Left side navigation */}
          <div className="flex items-center space-x-4">
            <div className="flex space-x-2 bg-white p-2 rounded-lg shadow-md transform -rotate-1">
              <NavButton onClick={() => router.back()} rotate="-rotate-3">
                <ChevronLeft className="h-5 w-5 text-gray-600" />
              </NavButton>
              <NavButton onClick={() => router.forward()} rotate="rotate-3">
                <ChevronRight className="h-5 w-5 text-gray-600" />
              </NavButton>
            </div>
          </div>

          {/* Right side buttons */}
          <div className="flex items-center space-x-4 bg-white p-2 rounded-lg shadow-md transform rotate-1">
            {isAdmin && (
              <>
                <NavButton onClick={handleFileSelect}>
                  <Upload className="h-5 w-5 text-gray-600" />
                </NavButton>
                <NavButton onClick={handleSettings}>
                  <Settings className="h-5 w-5 text-gray-600" />
                </NavButton>
              </>
            )}
            <NavButton onClick={handleLogout}>
              <LogOut className="h-5 w-5 text-gray-600" />
            </NavButton>
          </div>

          {/* Decorative elements */}
          <div className="absolute -bottom-2 left-12 w-16 h-16 bg-blue-100/20 rounded-full transform -translate-y-1/2" />
          <div className="absolute -bottom-2 right-12 w-12 h-12 bg-green-100/20 rounded-full transform -translate-y-1/2" />
        </div>
      </nav>

      {/* Add spacing below navbar to prevent content overlap */}
      <div className="h-20" />

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Choose Upload Location</h2>
            
            <div className="space-y-4">
              {selectedFile && (
                <div className="text-sm text-gray-600">
                  Selected file: {selectedFile.name}
                </div>
              )}
              
              <select
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="w-full p-2 border rounded-lg"
              >
                <option value="">Select a folder</option>
                {folders.map((folder) => (
                  <option key={folder.name} value={folder.name}>
                    {folder.name}
                  </option>
                ))}
              </select>

              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => {
                    setShowModal(false);
                    setSelectedFile(null);
                    setSelectedFolder('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFolder || isUploading}
                >
                  {isUploading ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;