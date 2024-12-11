// /lib/auth.ts
import { auth } from "./firebase-client";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User
} from "firebase/auth";
import { FirebaseError } from 'firebase/app';

// Define a User type for more structured return values
type AuthenticatedUser = User | null;

// Custom error type for auth operations
interface AuthOperationError {
  code: string;
  message: string;
}

// Helper function to format Firebase errors
const handleFirebaseError = (error: FirebaseError): AuthOperationError => {
  return {
    code: error.code,
    message: error.message
  };
};

// Login function
export const login = async (email: string, password: string): Promise<AuthenticatedUser> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    if (error instanceof FirebaseError) {
      const authError = handleFirebaseError(error);
      console.error("Login error:", authError.message);
      throw authError;
    }
    console.error("Unexpected login error");
    throw new Error("An unexpected error occurred during login");
  }
};

// Register function
export const register = async (email: string, password: string): Promise<AuthenticatedUser> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    if (error instanceof FirebaseError) {
      const authError = handleFirebaseError(error);
      console.error("Registration error:", authError.message);
      throw authError;
    }
    console.error("Unexpected registration error");
    throw new Error("An unexpected error occurred during registration");
  }
};

// Logout function
export const logout = async (): Promise<void> => {
  try {
    await signOut(auth);
    console.log("Logged out successfully");
  } catch (error) {
    if (error instanceof FirebaseError) {
      const authError = handleFirebaseError(error);
      console.error("Logout error:", authError.message);
      throw authError;
    }
    console.error("Unexpected logout error");
    throw new Error("An unexpected error occurred during logout");
  }
};

// Export types that might be useful in other parts of the app
export type { AuthenticatedUser, AuthOperationError };