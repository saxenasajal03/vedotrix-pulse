import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Profile } from '../types';
import {
  X,
  Mail,
  Phone,
  Building2,
  Calendar,
  Shield,
  MessageSquare,
  Camera,
  Check,
  Copy,
  ExternalLink,
  UserCheck,
  Briefcase
} from 'lucide-react';
import { formatISTDate } from '../lib/serialUtils';
import { uploadFileToStorage } from '../lib/storage';
import { INITIAL_ORGS, INITIAL_PROFILES } from '../lib/mockData';

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
  const { currentProfile, orgProfiles, currentOrg, allOrganizations, updateProfile, addToast } = useApp();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !profile) return null;

  const isSelf = profile.id === currentProfile.id;

  // Resolve Organization accurately
  const isBnkProfile = profile.orgId === '11111111-2222-3333-4444-555555555555';
  const bnkOrgFallback = allOrganizations?.find(o => o.orgCode === 'BNK' || o.id === '11111111-2222-3333-4444-555555555555') || INITIAL_ORGS[0];
  const profileOrg = allOrganizations?.find((o) => o.id === profile.orgId) || (isBnkProfile ? bnkOrgFallback : currentOrg);

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

  // Profile Photo Upload & Compression
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('Invalid File', 'Please select a valid image file (PNG, JPG, WebP).', 'warning');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      addToast('File Too Large', 'Please select an image smaller than 10MB.', 'warning');
      return;
    }

    setIsUploadingPhoto(true);

    try {
      const compressImage = (f: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const maxDim = 400;
              let width = img.width;
              let height = img.height;

              if (width > height) {
                if (width > maxDim) {
                  height = Math.round((height * maxDim) / width);
                  width = maxDim;
                }
              } else {
                if (height > maxDim) {
                  width = Math.round((width * maxDim) / height);
                  height = maxDim;
                }
              }

              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                resolve(dataUrl);
              } else {
                resolve(event.target?.result as string);
              }
            };
            img.onerror = reject;
            img.src = event.target?.result as string;
          };
          reader.onerror = reject;
          reader.readAsDataURL(f);
        });
      };

      const compressedDataUrl = await compressImage(file);

      // Attempt upload to Supabase storage with fallback to compressed data URL
      let finalAvatarUrl = compressedDataUrl;
      try {
        const storageResult = await uploadFileToStorage(file, 'avatars', `avatar_${profile.id}`);
        if (storageResult.success && storageResult.url) {
          finalAvatarUrl = storageResult.url;
        }
      } catch {}

      // Update in Supabase profiles & AppContext state
      await updateProfile(profile.id, { avatarUrl: finalAvatarUrl });
      try {
        localStorage.setItem(`vdx_avatar_${profile.id}`, finalAvatarUrl);
      } catch {}

      addToast('Profile Picture Updated 📸', 'Your new photo is now active across Team Chat & Vedotrix Pulse.', 'success');
    } catch (err) {
      addToast('Upload Failed', 'Could not update profile photo.', 'error');
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
      {/* Hidden Photo Upload Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handlePhotoUpload}
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
      />

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-color)] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh] overflow-hidden text-[var(--text-primary)] animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
      >
        {/* Banner Cover with Sticky Touch-Friendly Close Button */}
        <div className="h-24 sm:h-28 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full bg-slate-900/60 hover:bg-slate-900 text-white transition backdrop-blur-xs shadow-md z-20"
            title="Close Profile"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Profile Content */}
        <div className="px-5 sm:px-6 pt-0 pb-4 overflow-y-auto flex-1 overscroll-contain">
          {/* Avatar with Camera Overlay */}
          <div className="relative -mt-12 sm:-mt-14 mb-3 inline-block">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[var(--bg-card)] p-1.5 shadow-xl border-2 border-[var(--border-color)]">
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-xl sm:text-2xl flex items-center justify-center overflow-hidden">
                {profile.avatarUrl && profile.avatarUrl !== '/vedotrix-logo.png' ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.firstName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>
                    {profile.firstName?.[0] || 'U'}
                    {profile.lastName?.[0] || ''}
                  </span>
                )}
              </div>
            </div>

            {/* Active Indicator */}
            <span
              className={`w-3.5 h-3.5 rounded-full absolute bottom-1 right-1 border-2 border-[var(--bg-card)] ${
                profile.isActive ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
              title={profile.isActive ? 'Active Member' : 'Inactive'}
            />

            {/* Camera Change Icon if Self */}
            {isSelf && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="absolute bottom-0 left-0 p-1.5 sm:p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg border-2 border-[var(--bg-card)] transition hover:scale-105 active:scale-95"
                title="Change Profile Photo"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Name & Role Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] truncate">
                  {profile.firstName} {profile.lastName}
                </h2>
                {isSelf && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-blue-500/20 text-blue-400 uppercase shrink-0">
                    You
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-[var(--text-secondary)] mt-0.5 truncate">
                {profile.designation || 'Team Member'}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5 truncate">
                <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{profile.department || 'Operations'}</span>
                <span>•</span>
                <span className="truncate">{profileOrg.name}</span>
              </p>
            </div>

            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-600/10 text-blue-500 border border-blue-500/20 shrink-0">
              {profile.role}
            </span>
          </div>

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

            {/* Organization Info */}
            <div className="p-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)] space-y-1.5">
              <span className="text-[10px] text-[var(--text-muted)] block uppercase font-bold">
                Organization Details
              </span>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)] flex items-center gap-1.5 font-semibold truncate">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate">{profileOrg.name}</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 font-bold shrink-0">
                  {profileOrg.orgCode}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                {profileOrg.address || (isBnkProfile ? 'BNK Digital, 5/237, Vipul Khand, Gomtinagar, Lucknow - 226001' : 'Corporate Headquarters')}
              </p>
              <div className="flex items-center justify-between pt-1 border-t border-[var(--border-color)] text-[11px]">
                <a
                  href={profileOrg.website || (isBnkProfile ? 'https://bnkdigitalagency.netlify.app' : 'https://vedotrix.com')}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline flex items-center gap-1 font-semibold truncate"
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  <span className="truncate">{profileOrg.website || (isBnkProfile ? 'https://bnkdigitalagency.netlify.app' : 'https://vedotrix.com')}</span>
                </a>
                <span className="text-[var(--text-muted)] font-mono shrink-0 ml-2">
                  {profileOrg.phone || (isBnkProfile ? '+91 6388043581' : '+91 80 4400 9900')}
                </span>
              </div>
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
