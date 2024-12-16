'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../lib/firebase-client';
import { db } from '../lib/firebase-client';
import { doc, updateDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import Button from '../components/ui/ButtonN';
import { Mail, Lock, Folder, UserCog } from 'lucide-react';

const Settings = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [users, setUsers] = useState<Array<{id: string, email: string, role: string}>>([]);
  const [currentUserRole, setCurrentUserRole] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('user');

  useEffect(() => {
    const loadUserSettings = async () => {
      const user = auth.currentUser;
      if (!user) {
        router.push('/');
        return;
      }

      setEmail(user.email || '');

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setFolderPath(userDoc.data().folderPath || '');
          setCurrentUserRole(userDoc.data().role || 'user');
        }

        // Only load users list if current user is admin
        if (userDoc.data()?.role === 'admin') {
          const usersSnapshot = await getDocs(collection(db, 'users'));
          const usersData = usersSnapshot.docs.map(doc => ({
            id: doc.id,
            email: doc.data().email || 'No email',
            role: doc.data().role || 'user',
            folderPath: doc.data().folderPath
          }));
          setUsers(usersData);
          
        }
      } catch (err) {
        setError('Failed to load settings');
        console.error(err);
      }
    };

    loadUserSettings();
  }, [router]);

  const handleReauthenticate = async () => {
    const user = auth.currentUser;
    if (!user || !user.email) return false;
  
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      return true;
    } catch {  // Removed the error parameter completely
      setError('Invalid current password');
      return false;
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const user = auth.currentUser;
    if (!user) return;

    try {
      if (await handleReauthenticate()) {
        await updateEmail(user, newEmail);
        setSuccess('Email updated successfully');
        setNewEmail('');
        setCurrentPassword('');
      }
    } catch (err) {
      setError('Failed to update email');
      console.error(err);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const user = auth.currentUser;
    if (!user) return;

    try {
      if (await handleReauthenticate()) {
        await updatePassword(user, newPassword);
        setSuccess('Password updated successfully');
        setNewPassword('');
        setCurrentPassword('');
      }
    } catch (err) {
      setError('Failed to update password');
      console.error(err);
    }
  };

  const handleUpdateFolderPath = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const user = auth.currentUser;
    if (!user) return;

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        folderPath: folderPath
      });
      setSuccess('Folder path updated successfully');
    } catch (err) {
      setError('Failed to update folder path');
      console.error(err);
    }
  };

  const handleUpdateUserRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedUserId || !selectedRole) {
      setError('Please select both a user and a role');
      return;
    }

    try {
      await updateDoc(doc(db, 'users', selectedUserId), {
        role: selectedRole
      });
      
      // Update local users state to reflect the change
      setUsers(users.map(user => 
        user.id === selectedUserId 
          ? { ...user, role: selectedRole }
          : user
      ));
      
      setSuccess(`Role updated successfully for user`);
      setSelectedUserId('');
      setSelectedRole('user');
    } catch (err) {
      setError('Failed to update user role');
      console.error(err);
    }
  };

  // Reusable components for scrapbook elements
  const TapeCorner = () => (
    <div className="absolute w-16 h-16 transform rotate-45 bg-yellow-100/70 -top-2 -left-2" />
  );

  const Sticker = ({ children, color }: { children: React.ReactNode; color: string }) => (
    <div className={`absolute ${color} rounded-full w-12 h-12 flex items-center justify-center transform rotate-12 shadow-md`}>
      {children}
    </div>
  );

  const FormInput = ({ 
    label, 
    type, 
    value, 
    onChange, 
    disabled = false, 
    required = false,
    accentColor = "blue" 
  }: {
    label: string;
    type: string;
    value: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    disabled?: boolean;
    required?: boolean;
    accentColor?: string;
  }) => (
    <div>
      <label className="block text-sm font-medium mb-1 text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        className={`w-full px-3 py-2 border-2 rounded-md ${
          disabled ? 'bg-gray-50' : 'bg-white'
        } focus:ring-2 focus:ring-${accentColor}-200`}
      />
    </div>
  );

  // Only render the role management section if the current user is an admin
  const RoleManagementSection = () => {
    if (currentUserRole !== 'admin') return null;

    return (
      <section className="bg-white p-6 rounded-lg shadow-md relative transform rotate-1 border-2 border-gray-200">
        <div className="absolute -right-3 -top-3">
          <Sticker color="bg-orange-200">
            <UserCog className="w-6 h-6 text-orange-600" />
          </Sticker>
        </div>
        <TapeCorner />
        <h2 className="text-xl font-bold mb-4 text-gray-800">Manage User Roles</h2>
        <form onSubmit={handleUpdateUserRole} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Select User</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-3 py-2 border-2 rounded-md bg-white focus:ring-2 focus:ring-orange-200"
              required
            >
              <option value="">Choose a user...</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.email} (Current: {user.role || 'user'})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Select Role</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-3 py-2 border-2 rounded-md bg-white focus:ring-2 focus:ring-orange-200"
              required
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <Button variant="default" className="w-full bg-orange-500 hover:bg-orange-600 transform hover:rotate-1 transition-all">
            Update Role
          </Button>
        </form>
      </section>
    );
  };

  return (
    <div className="max-w-3xl mx-auto p-6 min-h-screen bg-[#f5e6d3]">
      <div className="text-center mb-12 relative">
        <h1 className="text-4xl font-bold mb-8 font-indie relative inline-block">
          <span className="relative z-10 text-gray-800">My Scrapbook Settings</span>
          <div className="absolute -bottom-2 left-0 w-full h-4 bg-yellow-200/50 -rotate-1" />
        </h1>
      </div>

      {error && (
        <div className="bg-red-100 border-2 border-red-400 text-red-700 px-4 py-3 rounded mb-4 relative transform -rotate-1">
          <TapeCorner />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border-2 border-green-400 text-green-700 px-4 py-3 rounded mb-4 relative transform rotate-1">
          <TapeCorner />
          {success}
        </div>
      )}

      <div className="space-y-8">
        {/* Update Email Section */}
        <section className="bg-white p-6 rounded-lg shadow-md relative transform -rotate-1 border-2 border-gray-200">
          <div className="absolute -right-3 -top-3">
            <Sticker color="bg-blue-200">
              <Mail className="w-6 h-6 text-blue-600" />
            </Sticker>
          </div>
          <TapeCorner />
          <h2 className="text-xl font-bold mb-4 text-gray-800">Update Email</h2>
          <form onSubmit={handleUpdateEmail} className="space-y-4">
            <FormInput
              label="Current Email"
              type="email"
              value={email}
              disabled={true}
            />
            <FormInput
              label="New Email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required={true}
              accentColor="blue"
            />
            <FormInput
              label="Current Password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required={true}
              accentColor="blue"
            />
            <Button variant="default" className="w-full bg-blue-500 hover:bg-blue-600 transform hover:-rotate-1 transition-all">
              Update Email
            </Button>
          </form>
        </section>

        {/* Update Password Section */}
        <section className="bg-white p-6 rounded-lg shadow-md relative transform rotate-1 border-2 border-gray-200">
          <div className="absolute -right-3 -top-3">
            <Sticker color="bg-purple-200">
              <Lock className="w-6 h-6 text-purple-600" />
            </Sticker>
          </div>
          <TapeCorner />
          <h2 className="text-xl font-bold mb-4 text-gray-800">Update Password</h2>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <FormInput
              label="Current Password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required={true}
              accentColor="purple"
            />
            <FormInput
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required={true}
              accentColor="purple"
            />
            <Button variant="default" className="w-full bg-purple-500 hover:bg-purple-600 transform hover:rotate-1 transition-all">
              Update Password
            </Button>
          </form>
        </section>

        {/* Update Folder Path Section */}
        <section className="bg-white p-6 rounded-lg shadow-md relative transform -rotate-1 border-2 border-gray-200">
          <div className="absolute -right-3 -top-3">
            <Sticker color="bg-green-200">
              <Folder className="w-6 h-6 text-green-600" />
            </Sticker>
          </div>
          <TapeCorner />
          <h2 className="text-xl font-bold mb-4 text-gray-800">Update Folder Path</h2>
          <form onSubmit={handleUpdateFolderPath} className="space-y-4">
            <FormInput
              label="Folder Path"
              type="text"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              required={true}
              accentColor="green"
            />
            <Button variant="default" className="w-full bg-green-500 hover:bg-green-600 transform hover:-rotate-1 transition-all">
              Update Folder Path
            </Button>
          </form>
        </section>

        {/* Role Management Section */}
        <RoleManagementSection />
      </div>
    </div>
  );
};

export default Settings;