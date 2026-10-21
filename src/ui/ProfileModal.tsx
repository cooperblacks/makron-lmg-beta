import React, { useEffect, useState } from 'react';
import { Camera, Check, Mail, Shield, User, X } from 'lucide-react';
import { AuthUser, VerifiedType } from '../types';
import { AvatarCropperModal } from './AvatarCropperModal';
import { VerifiedBadge } from './VerifiedBadge';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser | null;
  token: string | null;
  onProfileUpdated: (updatedUser: AuthUser) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  token,
  onProfileUpdated,
}) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [verifiedType, setVerifiedType] = useState<VerifiedType>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setUsername(user.username || user.email.split('@')[0] || '');
      setEmail(user.email || '');
      setAvatar(user.avatar || null);
      setVerifiedType(user.verifiedType || null);
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          username: username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ''),
          email: email.trim().toLowerCase(),
          avatar,
          verifiedType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      onProfileUpdated(data.user);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err: any) {
      setError(err.message || 'Error updating profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-sm w-full p-6 shadow-2xl relative select-none">
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-blue-500" />
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              Account Profile Settings
            </h2>
          </div>

          {error && (
            <div className="mb-3 p-2.5 rounded bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-3 p-2.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              <span>Profile updated successfully!</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            {/* Avatar Section */}
            <div className="flex items-center gap-3.5 pb-2 border-b border-neutral-200 dark:border-neutral-800">
              <div
                onClick={() => setIsCropperOpen(true)}
                title="Click to change and crop avatar"
                className="relative group cursor-pointer shrink-0"
              >
                <div className="w-14 h-14 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center overflow-hidden border-2 border-neutral-300 dark:border-neutral-700 shadow-sm">
                  {avatar && avatar.startsWith('data:image') ? (
                    <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg">
                      {(name || user.email || 'U')[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                  <Camera className="w-4 h-4" />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                    {name || user.email.split('@')[0]}
                  </span>
                  <VerifiedBadge type={verifiedType} size="md" />
                </div>
                <p className="text-[11px] text-neutral-500">
                  Click avatar to upload and crop
                </p>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                Display Name
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Your Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                Username (Handle)
              </label>
              <div className="relative">
                <span className="text-xs text-neutral-400 absolute left-2.5 top-2">@</span>
                <input
                  type="text"
                  placeholder="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 text-xs rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                Account Verification Type
              </label>
              <select
                value={verifiedType || ''}
                onChange={(e) => setVerifiedType((e.target.value as VerifiedType) || null)}
                className="w-full px-2.5 py-1.5 text-xs rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100"
              >
                <option value="">None (Standard User)</option>
                <option value="paid">Premium Member (Golden Check)</option>
                <option value="celeb">Verified Member (Blue Check)</option>
                <option value="dev">Verified Developer (Purple Check)</option>
                <option value="founder">Makron Founder (Green Check)</option>
              </select>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs rounded text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-1.5 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {loading ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <AvatarCropperModal
        isOpen={isCropperOpen}
        onClose={() => setIsCropperOpen(false)}
        initialImage={avatar || undefined}
        title="Crop & Resize Profile Avatar"
        onCropComplete={(croppedBase64) => setAvatar(croppedBase64)}
      />
    </>
  );
};
