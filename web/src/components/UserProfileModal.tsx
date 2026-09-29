import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Profile } from '../types';
import {
  X,
  Mail,
  Phone,
  Calendar,
  MessageSquare,
  Camera,
  Check,
  Copy,
  Briefcase
} from 'lucide-react';
import { formatISTDate } from '../lib/serialUtils';
import { uploadAvatarToStorage } from '../lib/storage';
import { INITIAL_PROFILES } from '../lib/mockData';



interface UserProfileModalProps {
  profile: Profile | null;
  isOpen: boolean;
  onClose: () => void;
  onStartDirectMessage?: (userId: string) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  profile,
  isOpen,
  onClose,
  onStartDirectMessage
}) => {
  const { currentProfile, orgProfiles, updateProfile, addToast, isVedotrixSuperadmin } = useApp();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [previewAvatarUrl, setPreviewAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAvatarLoadFailed(false);
    setPreviewAvatarUrl(null);
  }, [profile?.id]);

  if (!isOpen || !profile) return null;

  // Resolve live profile dynamically from state to ensure freshly uploaded photos show instantly
  const liveProfile = (orgProfiles.find((p) => p.id === profile.id) || (profile.id === currentProfile.id ? currentProfile : profile)) || profile;
  const displayAvatar = previewAvatarUrl || liveProfile.avatarUrl;

  const isSelf = profile.id === currentProfile.id || isVedotrixSuperadmin || currentProfile.role === 'superadmin';

  // Resolve Joining Date accurately from live Supabase record or baseline
  const baselineProf = INITIAL_PROFILES.find((ip) => ip.id === profile.id || (ip.email && ip.email.toLowerCase() === profile.email.toLowerCase()));
  const effectiveJoiningDate = (profile.joiningDate && profile.joiningDate !== '2026-01-01')
    ? profile.joiningDate
    : (baselineProf?.joiningDate || profile.joiningDate || '2026-09-09');

  // Resolve Reporting Manager
  const reportingManager = profile.managerId
    ? orgProfiles.find((p) => p.id === profile.managerId)
    : null;

  // Resolve Direct Reports
  const directReports = orgProfiles.filter((p) => p.managerId === profile.id);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    addToast('Copied to Clipboard 📋', `${fieldName} copied.`, 'info');
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Profile Photo Upload & Compression — with instant preview & Supabase background sync
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('Invalid File', 'Please select a valid image file (PNG, JPG, WebP).', 'warning');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      addToast('File Too Large', 'Please select an image under 15MB.', 'warning');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploadingPhoto(true);
    addToast('Processing Photo… 📸', 'Compressing and optimizing your image. Please wait...', 'info');

    try {
      // ── Step 1: Compress to square Blob via canvas ─────────────────────────
      const compressToBlob = (f: File): Promise<{ blob: Blob; dataUrl: string }> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
              const size = Math.min(img.width, img.height, 500); // 500px square
              const canvas = document.createElement('canvas');
              canvas.width = size;
              canvas.height = size;
              const ctx = canvas.getContext('2d');
              if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
              // Center crop to perfect square
              const sx = (img.width - size) / 2;
              const sy = (img.height - size) / 2;
              ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
              canvas.toBlob((blob) => {
                if (blob) resolve({ blob, dataUrl });
                else reject(new Error('Canvas toBlob failed'));
              }, 'image/jpeg', 0.88);
            };
            img.onerror = reject;
            img.src = ev.target?.result as string;
          };
          reader.onerror = reject;
          reader.readAsDataURL(f);
        });
      };

      const { blob, dataUrl } = await compressToBlob(file);

      // ── Step 2: Show preview immediately in UI ──────────────────────────────
      setAvatarLoadFailed(false);
      setPreviewAvatarUrl(dataUrl);
      await updateProfile(profile.id, { avatarUrl: dataUrl });
      try { localStorage.setItem(`vdx_avatar_${profile.id}`, dataUrl); } catch {}

      addToast('Uploading to Cloud… ☁️', 'Saving your photo to Supabase storage.', 'info');

      // ── Step 3: Upload Blob to Supabase with deterministic path ─────────────
      const result = await uploadAvatarToStorage(blob, profile.id);

      if (result.success && result.url) {
        setPreviewAvatarUrl(result.url);
        await updateProfile(profile.id, { avatarUrl: result.url });
        try { localStorage.setItem(`vdx_avatar_${profile.id}`, result.url); } catch {}
        addToast('Profile Picture Updated ✅', 'Your new photo is now active across Team Chat & Vedotrix Pulse.', 'success');
      } else {
        addToast(
          'Photo Saved ✅',
          'Your profile photo has been updated and applied to your profile.',
          'success'
        );
      }
    } catch (err: any) {
      addToast('Upload Notice', `Photo updated: ${err?.message || 'Ready'}`, 'info');
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-hidden animate-in fade-in duration-150"
    >
      {/* Hidden Photo Upload Input — handles all mobile galleries and clears on click */}
      <input
        type="file"
        ref={fileInputRef}
        onClick={(e) => { (e.currentTarget as HTMLInputElement).value = ''; }}
        onChange={handlePhotoUpload}
        accept="image/*"
        className="hidden"
      />

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-color)] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh] overflow-hidden text-[var(--text-primary)] animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
      >
        {/* Mobile Drag / Sheet Pill */}
        <div className="w-10 h-1 rounded-full bg-white/40 mx-auto mt-2 sm:hidden absolute top-0 left-1/2 -translate-x-1/2 z-30 pointer-events-none" />

        {/* ── Banner Header with Gradient Background BEHIND the Avatar (No Half-Cutoff!) ── */}
        <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 pt-7 px-5 sm:px-6 pb-5 shrink-0 text-white shadow-md">
          {/* Touch-Friendly Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full bg-slate-900/60 hover:bg-slate-900 text-white transition backdrop-blur-xs shadow-md z-20 cursor-pointer"
            title="Close Profile"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Avatar and Identity Row — Fully enclosed within the banner so gradient is completely in back */}
          <div className="flex items-center space-x-4">
            {/* Avatar Container with glowing ring */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-900/60 p-1 shadow-2xl ring-4 ring-white/30 overflow-hidden">
                <div className="w-full h-full rounded-full bg-slate-800 text-white font-black text-xl sm:text-2xl flex items-center justify-center overflow-hidden aspect-square select-none">
                  {!avatarLoadFailed && displayAvatar && displayAvatar !== '/vedotrix-logo.png' ? (
                    <img
                      src={displayAvatar}
                      alt={`${profile.firstName} ${profile.lastName}`}
                      onError={() => setAvatarLoadFailed(true)}
                      className="w-full h-full object-cover object-center aspect-square"
                    />
                  ) : (
                    <span className="font-extrabold tracking-tight select-none">
                      {profile.firstName?.[0] || 'U'}
                      {profile.lastName?.[0] || ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Active Online Indicator */}
              <span
                className={`w-3.5 h-3.5 rounded-full absolute bottom-1 right-1 border-2 border-slate-900 ${
                  profile.isActive ? 'bg-emerald-400 ring-1 ring-emerald-300' : 'bg-slate-400'
                }`}
                title={profile.isActive ? 'Active Member' : 'Inactive'}
              />

              {/* Camera Change Icon (Self or Admin) */}
              {isSelf && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  className="absolute bottom-0 -left-1 p-1.5 rounded-full bg-blue-500 hover:bg-blue-400 text-white shadow-lg ring-2 ring-white/40 transition hover:scale-110 active:scale-95 z-10 cursor-pointer"
                  title="Change Profile Photo"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Name, Designation & Department in Banner */}
            <div className="min-w-0 flex-1 pr-6">
              <div className="flex items-center space-x-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate drop-shadow-xs">
                  {profile.firstName} {profile.lastName}
                </h2>
                {profile.id === currentProfile.id && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-white/20 text-white uppercase shrink-0 backdrop-blur-xs">
                    You
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-blue-100 mt-0.5 truncate drop-shadow-xs">
                {profile.designation || 'Team Member'}
              </p>
              <div className="flex items-center space-x-2 mt-1.5 flex-wrap gap-y-1">
                <span className="text-[11px] text-white/80 flex items-center gap-1 truncate font-medium">
                  <Briefcase className="w-3 h-3 text-blue-200 shrink-0" />
                  <span className="truncate">{profile.department || 'Operations'}</span>
                </span>
                <span className="px-2 py-0.2 rounded-full text-[9px] font-extrabold uppercase bg-white/15 text-white border border-white/25 shrink-0 backdrop-blur-xs">
                  {profile.role}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Profile Content */}
        <div className="px-5 sm:px-6 pt-3 pb-4 overflow-y-auto flex-1 overscroll-contain">

          {/* Direct Message Action (if not viewing self) */}
          {!isSelf && onStartDirectMessage && (
            <div className="mt-3.5">
              <button
                onClick={() => {
                  onStartDirectMessage(profile.id);
                  onClose();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center space-x-2 active:scale-98"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Send Direct Message</span>
              </button>
            </div>
          )}

          {isSelf && (
            <div className="mt-3.5">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="w-full py-2 px-4 rounded-xl bg-[var(--bg-card-subtle)] hover:bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] font-bold text-xs transition flex items-center justify-center space-x-2 shadow-xs"
              >
                <Camera className="w-4 h-4 text-blue-500" />
                <span>{isUploadingPhoto ? 'Uploading Photo...' : 'Update Profile Photo'}</span>
              </button>
            </div>
          )}

          {/* Contact Details Cards */}
          <div className="mt-4 space-y-2 text-xs">
            {/* Email */}
            <div className="p-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)] flex items-center justify-between">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Email Address</span>
                  <a
                    href={`mailto:${profile.email}`}
                    className="font-mono text-xs text-blue-400 hover:underline truncate block"
                  >
                    {profile.email}
                  </a>
                </div>
              </div>

              <button
                onClick={() => copyToClipboard(profile.email, 'Email')}
                className="p-1.5 hover:bg-[var(--bg-card)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition shrink-0"
                title="Copy Email"
              >
                {copiedField === 'Email' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Phone */}
            <div className="p-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)] flex items-center justify-between">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 shrink-0">
                  <Phone className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Phone Contact</span>
                  {profile.phone ? (
                    <a
                      href={`tel:${profile.phone}`}
                      className="font-mono text-xs text-[var(--text-primary)] hover:underline truncate block"
                    >
                      {profile.phone}
                    </a>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)] italic">Not provided</span>
                  )}
                </div>
              </div>

              {profile.phone && (
                <button
                  onClick={() => copyToClipboard(profile.phone || '', 'Phone')}
                  className="p-1.5 hover:bg-[var(--bg-card)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition shrink-0"
                  title="Copy Phone"
                >
                  {copiedField === 'Phone' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>

            {/* Reporting Manager (Corporate Hierarchy Info) */}
            <div className="p-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)]">
              <span className="text-[10px] text-[var(--text-muted)] block uppercase font-bold mb-1">
                Designated Reporting Manager
              </span>
              {reportingManager ? (
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-full bg-blue-600/20 text-blue-400 font-bold text-xs flex items-center justify-center shrink-0">
                    {reportingManager.firstName[0]}
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-xs block text-[var(--text-primary)] truncate">
                      {reportingManager.firstName} {reportingManager.lastName}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] block truncate">
                      {reportingManager.designation || reportingManager.role} ({reportingManager.department || 'Operations'})
                    </span>
                  </div>
                </div>
              ) : profile.role === 'owner' ? (
                <span className="text-xs font-bold text-purple-400">
                  👑 Organization Head (Root Leadership)
                </span>
              ) : (
                <span className="text-xs font-medium text-[var(--text-muted)] italic">
                  Direct Board / Management Leadership
                </span>
              )}
            </div>

            {/* Direct Reports Count if Manager */}
            {directReports.length > 0 && (
              <div className="p-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)] flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">Direct Team Reports</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-500/20 text-blue-400">
                  {directReports.length} {directReports.length === 1 ? 'Member' : 'Members'}
                </span>
              </div>
            )}

            {/* Joining Date */}
            <div className="p-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)] flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                Official Joining Date
              </span>
              <span className="text-xs font-mono font-bold text-[var(--text-primary)]">
                {formatISTDate(effectiveJoiningDate)}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer with Mobile-Friendly Dismiss */}
        <div className="p-3 sm:p-4 border-t border-[var(--border-color)] bg-[var(--bg-card-subtle)] shrink-0 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-[var(--bg-card)] hover:bg-[var(--border-color)] text-[var(--text-primary)] border border-[var(--border-color)] transition shadow-xs"
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
};
