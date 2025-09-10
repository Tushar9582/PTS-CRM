// src/components/UpdateEmail.tsx

import React, { useState } from "react";
import {
  getAuth,
  signInWithEmailAndPassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  verifyBeforeUpdateEmail,
} from "firebase/auth";
import { database } from "../../firebase"; // adjust path
import { ref, update, get, child } from "firebase/database";

const UpdateEmail: React.FC = () => {
  const auth = getAuth();

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Update email state
  const [newEmail, setNewEmail] = useState("");
  const [message, setMessage] = useState("");

  // Step 1: Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    try {
      await signInWithEmailAndPassword(auth, loginEmail, password);
      setIsLoggedIn(true);
      setMessage("✅ Login successful. You can now update your email.");
    } catch (error: any) {
      setMessage(`❌ Login failed: ${error.message}`);
    }
  };

  // Step 2: Request email update (sends verification)
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    const user = auth.currentUser;

    if (!user || !user.email) {
      setMessage("❌ No user logged in.");
      return;
    }

    try {
      // Reauthenticate user with old credentials
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);

      // Send verification email to the new email address
      await verifyBeforeUpdateEmail(user, newEmail);

      // Store a "pendingNewEmail" so you know it's waiting verification
      await update(ref(database, `users/${user.uid}`), {
        pendingNewEmail: newEmail,
      });

      setMessage(
        "📧 Verification email sent to your new address. After verifying, login again to sync database."
      );
    } catch (error: any) {
      setMessage(`❌ Error updating email: ${error.message}`);
    }
  };

  // Step 3: Sync verified email into agents/{pushKey}
  const handleSyncEmail = async () => {
    const user = auth.currentUser;
    if (!user) {
      setMessage("❌ No user logged in.");
      return;
    }

    try {
      // Find all agents for this user
      const dbRef = ref(database, `users/${user.uid}/agents`);
      const snapshot = await get(dbRef);

      if (snapshot.exists()) {
        const agents = snapshot.val();

        // Loop through all pushKeys and update email field
        Object.keys(agents).forEach(async (pushKey) => {
          await update(ref(database, `users/${user.uid}/agents/${pushKey}`), {
            email: user.email,
          });
        });

        // Remove pendingNewEmail (cleanup)
        await update(ref(database, `users/${user.uid}`), {
          pendingNewEmail: null,
        });

        setMessage("✅ Database email updated successfully after verification.");
      } else {
        setMessage("⚠️ No agents found under this user.");
      }
    } catch (error: any) {
      setMessage(`❌ Error syncing email: ${error.message}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-md bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-bold text-center mb-4">
          {isLoggedIn ? "Update Email" : "Login"}
        </h2>

        {!isLoggedIn ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              placeholder="Current Email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-md"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-md"
            />
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
            >
              Login
            </button>
          </form>
        ) : (
          <>
            <form onSubmit={handleUpdateEmail} className="space-y-4">
              <input
                type="email"
                placeholder="New Email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-md"
              />
              <button
                type="submit"
                className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700"
              >
                Send Verification
              </button>
            </form>

            <button
              onClick={handleSyncEmail}
              className="w-full mt-4 bg-purple-600 text-white py-2 rounded-md hover:bg-purple-700"
            >
              Sync Verified Email to Agents
            </button>
          </>
        )}

        {message && (
          <p className="mt-4 text-center text-sm text-gray-700">{message}</p>
        )}
      </div>
    </div>
  );
};

export default UpdateEmail;