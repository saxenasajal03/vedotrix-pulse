import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { ChatMessage, Profile, ChatChannel, ChatAttachment } from '../types';
import {
  MessageSquare,
  Hash,
  Send,
  Smile,
  Users,
  Search,
  CheckCheck,
  Pin,
  Lock,
  Sparkles,
  Shield,
  Circle,
  Clock,
  MoreVertical,
  Paperclip,
  Headphones,
  Plus,
  Trash2,
  X,
  HelpCircle,
  Globe,
  Minimize2,
  Maximize2,
  ExternalLink,
  Bell,
  BellRing,
  BellOff,
  FileText,
  Film,
  Volume2,
  Image as ImageIcon,
  Download,
  CornerUpLeft,
  ChevronLeft,
  Check,
  Copy,
  Settings,
  UserPlus,
  UserMinus,
  LogOut,
  AtSign,
  Menu,
  List
} from 'lucide-react';
import { formatISTTime, formatISTDate } from '../lib/serialUtils';
import {
  requestDeviceNotificationPermission,
  getDeviceNotificationPermission,
  isDeviceNotificationSupported
} from '../lib/deviceNotifications';

// Maximum upload file size: 25MB (to protect Supabase free tier storage quotas)
const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export interface TeamChatProps {
  isWidgetMode?: boolean;
  onCloseWidget?: () => void;
  onMaximizeWidget?: () => void;
  onPopoutWindow?: () => void;
}

export const TeamChat: React.FC<TeamChatProps> = ({
  isWidgetMode = false,
  onCloseWidget,
  onMaximizeWidget,
  onPopoutWindow
}) => {
  const {
    currentOrg,
    currentProfile,
    orgProfiles,
    chatMessages,
    chatChannels,
    createChatChannel,
    updateChatChannel,
    deleteChatChannel,
    addMemberToChannel,
    removeMemberFromChannel,
    sendChatMessage,
    addChatReaction,
    activeChatChannel,
    setActiveChatChannel,
    isVedotrixSuperadmin,
    addToast
  } = useApp();

  const [inputText, setInputText] = useState('');
  const [searchContact, setSearchContact] = useState('');
  const [filterMessageQuery, setFilterMessageQuery] = useState('');
  const [showSearchMessages, setShowSearchMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [replyingTo, setReplyingTo] = useState<{ id: string; senderName: string; snippet: string } | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);

  // Phone & Widget responsive screen state: 'sidebar' or 'chat'
  const [mobileScreen, setMobileScreen] = useState<'sidebar' | 'chat'>('chat');

  // Device Notifications State
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [showNotifBanner, setShowNotifBanner] = useState(false);

  // Direct @mentions Autocomplete State
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionCursorPos, setMentionCursorPos] = useState(0);

  // New Channel / Group Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [isPrivateChannel, setIsPrivateChannel] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isSubmittingChannel, setIsSubmittingChannel] = useState(false);

  // Channel Settings & Member Management Modal State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'members' | 'settings'>('members');
  const [editChannelName, setEditChannelName] = useState('');
  const [editChannelDesc, setEditChannelDesc] = useState('');
  const [editIsPrivate, setEditIsPrivate] = useState(false);
  const [candidateMemberId, setCandidateMemberId] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize notification status
  useEffect(() => {
    if (isDeviceNotificationSupported()) {
      const perm = getDeviceNotificationPermission();
      setNotifPermission(perm);
      if (perm === 'default') {
        setShowNotifBanner(true);
      }
    }
  }, []);

  const handleRequestNotifications = async () => {
    const granted = await requestDeviceNotificationPermission();
    setNotifPermission(granted ? 'granted' : 'denied');
    setShowNotifBanner(false);
    if (granted) {
      addToast(
        'Device Notifications Enabled 🔔',
        'You will now receive alerts for incoming messages & mentions on your phone and desktop.',
        'success'
      );
    } else {
      addToast(
        'Notifications Restricted',
        'Notification permission was not granted. You can re-enable it in browser settings.',
        'warning'
      );
    }
  };

  // Helper to determine if current channel is a DM
  const isDirectMessage = activeChatChannel.startsWith('dm:');
  const dmTargetProfileId = isDirectMessage
    ? activeChatChannel.split(':').find((id) => id !== 'dm' && id !== currentProfile.id)
    : null;
  const dmTargetProfile = dmTargetProfileId
    ? orgProfiles.find((p) => p.id === dmTargetProfileId)
    : null;

  // Find active channel info
  const activeChannelObj = chatChannels.find((c) => c.id === activeChatChannel);

  // Elevated privileges check
  const isSuperOrHr =
    isVedotrixSuperadmin ||
    currentProfile.role === 'superadmin' ||
    currentProfile.role === 'owner' ||
    currentProfile.role === 'hr';

  const isChannelCreator = activeChannelObj && (activeChannelObj.createdBy === currentProfile.id || isSuperOrHr);

  // Sync settings modal values when opened
  useEffect(() => {
    if (activeChannelObj) {
      setEditChannelName(activeChannelObj.name);
      setEditChannelDesc(activeChannelObj.description || '');
      setEditIsPrivate(Boolean(activeChannelObj.isPrivate));
    }
  }, [activeChannelObj, isSettingsModalOpen]);

  // Filter messages for active channel
  const activeChannelMessages = chatMessages.filter((m) => {
    if (isDirectMessage) {
      if (!dmTargetProfileId) return false;
      const isSender = m.senderId === currentProfile.id && m.recipientId === dmTargetProfileId;
      const isReceiver = m.senderId === dmTargetProfileId && m.recipientId === currentProfile.id;
      return isSender || isReceiver;
    }
    return m.channel === activeChatChannel && !m.recipientId;
  });

  const displayedMessages = filterMessageQuery.trim()
    ? activeChannelMessages.filter(
        (m) =>
          m.message.toLowerCase().includes(filterMessageQuery.toLowerCase()) ||
          m.senderName.toLowerCase().includes(filterMessageQuery.toLowerCase()) ||
          m.attachments?.some((a) => a.name.toLowerCase().includes(filterMessageQuery.toLowerCase()))
      )
    : activeChannelMessages;

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChannelMessages.length, activeChatChannel]);

  // Handle @mention typing detection
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);

    const cursor = e.target.selectionStart || 0;
    setMentionCursorPos(cursor);

    const textBeforeCursor = val.slice(0, cursor);
    const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/);

    if (match) {
      setMentionQuery(match[1].toLowerCase());
      setShowMentionPopover(true);
      setMentionIndex(0);
    } else {
      setShowMentionPopover(false);
    }
  };

  // Mention autocomplete list
  const mentionCandidates = [
    ...(mentionQuery === '' || 'all'.includes(mentionQuery) || 'channel'.includes(mentionQuery)
      ? [{ id: 'all', name: 'all', role: 'Broadcast', designation: 'Notify everyone in channel', isSpecial: true }]
      : []),
    ...orgProfiles
      .filter((p) => {
        if (!mentionQuery) return true;
        const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
        return (
          fullName.includes(mentionQuery) ||
          p.firstName.toLowerCase().includes(mentionQuery) ||
          p.email.toLowerCase().includes(mentionQuery) ||
          (p.designation || '').toLowerCase().includes(mentionQuery)
        );
      })
      .map((p) => ({
        id: p.id,
        name: `${p.firstName} ${p.lastName}`.trim(),
        firstName: p.firstName,
        role: p.role,
        designation: p.designation || 'Team Member',
        isSpecial: false
      }))
  ].slice(0, 8);

  const insertMention = (candidate: { name: string }) => {
    const textBeforeCursor = inputText.slice(0, mentionCursorPos);
    const textAfterCursor = inputText.slice(mentionCursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex !== -1) {
      const newTextBefore = textBeforeCursor.slice(0, atIndex) + `@${candidate.name} `;
      setInputText(newTextBefore + textAfterCursor);
    }
    setShowMentionPopover(false);
    setMentionQuery('');
    textareaRef.current?.focus();
  };

  // Handle file selection with size guard (max 25MB)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        addToast(
          'File Exceeds 25MB Limit',
          `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)}MB. Free tier limit is capped at 25MB.`,
          'error'
        );
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        let category: ChatAttachment['category'] = 'other';
        if (file.type.startsWith('image/')) category = 'image';
        else if (file.type.startsWith('video/')) category = 'video';
        else if (file.type.startsWith('audio/')) category = 'audio';
        else if (
          file.type.includes('pdf') ||
          file.type.includes('document') ||
          file.type.includes('sheet') ||
          file.type.includes('presentation') ||
          file.type.includes('text') ||
          file.name.endsWith('.csv') ||
          file.name.endsWith('.json') ||
          file.name.endsWith('.zip')
        ) {
          category = 'document';
        }

        const newAttachment: ChatAttachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          url: result,
          category
        };

        setPendingAttachments((prev) => [...prev, newAttachment]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePendingAttachment = (id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && pendingAttachments.length === 0) return;

    const text = inputText;
    const attachmentsToSend = [...pendingAttachments];
    const replyContext = replyingTo
      ? { id: replyingTo.id, snippet: `${replyingTo.senderName}: ${replyingTo.snippet}` }
      : undefined;

    setInputText('');
    setPendingAttachments([]);
    setReplyingTo(null);
    setShowMentionPopover(false);
    setIsSending(true);

    try {
      await sendChatMessage(
        text,
        activeChatChannel,
        isDirectMessage && dmTargetProfileId ? dmTargetProfileId : undefined,
        attachmentsToSend.length > 0 ? attachmentsToSend : undefined,
        replyContext
      );
    } catch (err) {
      addToast('Error Sending', 'Message could not be dispatched.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionPopover && mentionCandidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % mentionCandidates.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + mentionCandidates.length) % mentionCandidates.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(mentionCandidates[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionPopover(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSelectDm = (targetUser: Profile) => {
    const sortedIds = [currentProfile.id, targetUser.id].sort();
    const dmKey = `dm:${sortedIds[0]}:${sortedIds[1]}`;
    setActiveChatChannel(dmKey);
    setMobileScreen('chat');
  };

  const handleSelectChannel = (channelId: string) => {
    setActiveChatChannel(channelId);
    setMobileScreen('chat');
  };

  const handleCreateChannelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    setIsSubmittingChannel(true);
    try {
      const created = await createChatChannel({
        name: newChannelName.trim(),
        description: newChannelDesc.trim() || (isPrivateChannel ? 'Private Group Channel' : 'Public Department Channel'),
        isPrivate: isPrivateChannel,
        memberIds: isPrivateChannel ? Array.from(new Set([currentProfile.id, ...selectedMemberIds])) : undefined
      });
      setActiveChatChannel(created.id);
      setIsCreateModalOpen(false);
      setNewChannelName('');
      setNewChannelDesc('');
      setIsPrivateChannel(false);
      setSelectedMemberIds([]);
      setMobileScreen('chat');
    } catch (err) {
      addToast('Creation Failed', 'Could not create channel.', 'error');
    } finally {
      setIsSubmittingChannel(false);
    }
  };

  const handleSaveChannelSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChannelObj) return;

    try {
      await updateChatChannel(activeChannelObj.id, {
        name: editChannelName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
        description: editChannelDesc.trim(),
        isPrivate: editIsPrivate
      });
      setIsSettingsModalOpen(false);
    } catch (err) {
      addToast('Save Failed', 'Could not update channel settings.', 'error');
    }
  };

  const handleAddMemberToCurrentChannel = async () => {
    if (!candidateMemberId || !activeChannelObj) return;
    await addMemberToChannel(activeChannelObj.id, candidateMemberId);
    setCandidateMemberId('');
  };

  const handleRemoveMemberFromCurrentChannel = async (memberId: string) => {
    if (!activeChannelObj) return;
    if (window.confirm('Remove this member from the channel?')) {
      await removeMemberFromChannel(activeChannelObj.id, memberId);
    }
  };

  const toggleMemberSelection = (empId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const copyMessageText = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast('Copied to Clipboard 📋', 'Message text copied.', 'info');
  };

  const handlePopoutToSeparateWindow = () => {
    if (onPopoutWindow) {
      onPopoutWindow();
      return;
    }
    const currentUrl = window.location.href.split('#')[0];
    const popoutUrl = `${currentUrl}#widget`;
    window.open(popoutUrl, 'VedotrixPulseChat', 'width=520,height=760,menubar=no,toolbar=no,location=no,status=no');
  };

  const QUICK_EMOJIS = ['👍', '❤️', '🚀', '🎉', '🔥', '👀', '💯', '👏', '🙌', '💡'];

  const filteredColleagues = orgProfiles
    .filter((p) => p.id !== currentProfile.id)
    .filter((p) => {
      if (!searchContact.trim()) return true;
      const q = searchContact.toLowerCase();
      return (
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.designation || '').toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q)
      );
    });

  // Sole standard channel is support; others are custom user-created channels
  const publicChannels = chatChannels.filter((c) => !c.isPrivate && c.type !== 'group');
  const privateGroupChannels = chatChannels.filter((c) => c.isPrivate || c.type === 'group');

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Helper to highlight @mentions in messages
  const renderMessageContent = (text: string) => {
    if (!text) return null;
    const mentionRegex = /(@[A-Za-z0-9_.-]+(?:\s[A-Za-z0-9_.-]+)?)/g;
    const parts = text.split(mentionRegex);

    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const isMyMention =
          part.toLowerCase().includes(currentProfile.firstName.toLowerCase()) ||
          part.toLowerCase() === '@all' ||
          part.toLowerCase() === '@channel';

        return (
          <span
            key={index}
            className={`inline-flex items-center px-1.5 py-0.2 rounded font-bold text-[11px] mx-0.5 ${
              isMyMention
                ? 'bg-amber-400/25 text-amber-300 border border-amber-400/40 shadow-xs'
                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            }`}
          >
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Non-member colleagues for adding to channel
  const channelMemberIds = new Set(activeChannelObj?.memberIds || []);
  const availableToAddColleagues = orgProfiles.filter(
    (p) => !channelMemberIds.has(p.id) && p.id !== activeChannelObj?.createdBy
  );

  return (
    <div
      className={`rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-2xl overflow-hidden flex flex-col md:flex-row transition-colors duration-200 ${
        isWidgetMode ? 'h-full w-full' : 'h-[calc(100vh-140px)] min-h-[580px]'
      }`}
    >
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        multiple
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.json,.zip"
        className="hidden"
      />

      {/* 1. Sidebar: Channels & Direct Messages List */}
      <div
        className={`${
          mobileScreen === 'sidebar' ? 'flex' : 'hidden md:flex'
        } w-full md:w-72 lg:w-80 border-r border-[var(--border-color)] flex-col bg-[var(--bg-card-subtle)] shrink-0 h-full overflow-hidden`}
      >
        {/* Workspace Brand & Header */}
        <div className="p-3.5 border-b border-[var(--border-color)] bg-[var(--bg-card)]/70">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center space-x-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs font-bold text-[var(--text-primary)] tracking-tight truncate">
                  {currentOrg.name}
                </h2>
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-emerald-400 font-semibold">Realtime Connected</span>
                </div>
              </div>
            </div>

            {/* Notification Bell Toggle */}
            <button
              onClick={handleRequestNotifications}
              title={
                notifPermission === 'granted'
                  ? 'Device notifications active'
                  : 'Enable phone & desktop push notifications'
              }
              className={`p-1.5 rounded-lg border transition ${
                notifPermission === 'granted'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-blue-500'
              }`}
            >
              {notifPermission === 'granted' ? (
                <BellRing className="w-4 h-4" />
              ) : notifPermission === 'denied' ? (
                <BellOff className="w-4 h-4 text-rose-500" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Quick Search Contacts */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchContact}
              onChange={(e) => setSearchContact(e.target.value)}
              placeholder="Search colleagues or channels..."
              className="w-full pl-8 pr-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </div>
        </div>

        {/* Scrollable Channels & DMs */}
        <div className="flex-1 overflow-y-auto p-2 space-y-3.5 text-xs">
          {/* Organization Channels */}
          <div>
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between">
              <span>Channels</span>
              <button
                onClick={() => {
                  setIsPrivateChannel(false);
                  setIsCreateModalOpen(true);
                }}
                className="text-blue-500 hover:text-blue-400 flex items-center space-x-0.5 text-[10px] font-bold hover:underline"
              >
                <Plus className="w-3 h-3" />
                <span>New</span>
              </button>
            </div>
            <div className="space-y-0.5 mt-1">
              {publicChannels.map((ch) => {
                const isActive = activeChatChannel === ch.id;
                const isSupport = ch.id === 'support';
                const unread = chatMessages.filter(
                  (m) => m.channel === ch.id && m.senderId !== currentProfile.id
                ).length;

                return (
                  <button
                    key={ch.id}
                    onClick={() => handleSelectChannel(ch.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition text-left ${
                      isActive
                        ? isSupport
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-blue-600 text-white shadow-xs'
                        : isSupport
                        ? 'text-indigo-400 hover:bg-indigo-500/10 font-bold bg-indigo-500/5'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      {isSupport ? (
                        <Headphones className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-indigo-400'}`} />
                      ) : (
                        <Hash className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-[var(--text-muted)]'}`} />
                      )}
                      <span className="truncate">{ch.name}</span>
                      {isSupport && (
                        <span
                          className={`text-[8px] px-1 py-0.2 rounded font-extrabold uppercase shrink-0 ${
                            isActive ? 'bg-white/20 text-white' : 'bg-indigo-500/20 text-indigo-300'
                          }`}
                        >
                          Helpdesk
                        </span>
                      )}
                    </div>
                    {unread > 0 && !isActive && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Groups & Private Channels */}
          <div>
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between">
              <span>Private Groups</span>
              <button
                onClick={() => {
                  setIsPrivateChannel(true);
                  setIsCreateModalOpen(true);
                }}
                className="text-amber-500 hover:text-amber-400 flex items-center space-x-0.5 text-[10px] font-bold hover:underline"
              >
                <Plus className="w-3 h-3" />
                <span>Group</span>
              </button>
            </div>
            <div className="space-y-0.5 mt-1">
              {privateGroupChannels.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-[var(--text-muted)] italic">
                  No private groups created yet.
                </div>
              ) : (
                privateGroupChannels.map((ch) => {
                  const isActive = activeChatChannel === ch.id;

                  return (
                    <div
                      key={ch.id}
                      className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                        isActive
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <button
                        onClick={() => handleSelectChannel(ch.id)}
                        className="flex items-center space-x-2 truncate flex-1 text-left"
                      >
                        <Lock className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-amber-500'}`} />
                        <span className="truncate">{ch.name}</span>
                        {ch.memberIds && (
                          <span
                            className={`text-[9px] px-1 rounded shrink-0 ${
                              isActive ? 'bg-white/20 text-white' : 'bg-[var(--bg-card)] text-[var(--text-muted)]'
                            }`}
                          >
                            {ch.memberIds.length}
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Direct Messages with Colleagues */}
          <div>
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between">
              <span>Direct Messages</span>
              <span className="text-[9px] font-semibold text-[var(--text-muted)]">{filteredColleagues.length}</span>
            </div>
            <div className="space-y-0.5 mt-1">
              {filteredColleagues.map((colleague) => {
                const sortedIds = [currentProfile.id, colleague.id].sort();
                const dmKey = `dm:${sortedIds[0]}:${sortedIds[1]}`;
                const isActive = activeChatChannel === dmKey;
                const unread = chatMessages.filter(
                  (m) => m.senderId === colleague.id && m.recipientId === currentProfile.id
                ).length;

                return (
                  <button
                    key={colleague.id}
                    onClick={() => handleSelectDm(colleague)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition text-left ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <div className="relative shrink-0">
                        <div
                          className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-color)]'
                          }`}
                        >
                          {colleague.firstName[0]}
                        </div>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 absolute bottom-0 right-0 border-2 border-[var(--bg-card)]" />
                      </div>
                      <div className="truncate">
                        <span className="block truncate font-medium text-xs">
                          {colleague.firstName} {colleague.lastName}
                        </span>
                        <span
                          className={`block text-[9px] truncate ${
                            isActive ? 'text-blue-100' : 'text-[var(--text-muted)]'
                          }`}
                        >
                          {colleague.role} • {colleague.designation || 'Staff'}
                        </span>
                      </div>
                    </div>
                    {unread > 0 && !isActive && (
                      <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[9px] font-bold shrink-0">
                        {unread}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Current User Footnote */}
        <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-card)] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 truncate">
            <div className="w-7 h-7 rounded-full bg-blue-600/20 text-blue-500 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-500/30">
              {currentProfile.firstName[0]}
            </div>
            <div className="truncate">
              <span className="text-xs font-bold text-[var(--text-primary)] block truncate">
                {currentProfile.firstName} {currentProfile.lastName}
              </span>
              <span className="text-[10px] text-[var(--text-muted)] font-medium block uppercase tracking-wide truncate">
                {currentProfile.role}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Slack-Style Conversation Panel */}
      <div
        className={`${
          mobileScreen === 'chat' ? 'flex' : 'hidden md:flex'
        } flex-1 flex flex-col bg-[var(--bg-page)]/40 h-full overflow-hidden`}
      >
        {/* Chat Header Bar */}
        <div className="px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-card)] shrink-0 shadow-xs">
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            {/* Mobile / Widget Drawer Button */}
            <button
              onClick={() => setMobileScreen('sidebar')}
              className="md:hidden p-1.5 -ml-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-card-subtle)] transition flex items-center space-x-0.5 text-xs font-bold shrink-0"
              title="Channels list"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {isDirectMessage && dmTargetProfile ? (
              <div className="flex items-center space-x-2.5 truncate">
                <div className="relative shrink-0">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs flex items-center justify-center border border-blue-500/30">
                    {dmTargetProfile.firstName[0]}
                    {dmTargetProfile.lastName?.[0] || ''}
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute bottom-0 right-0 border-2 border-[var(--bg-card)]" />
                </div>
                <div className="truncate">
                  <div className="flex items-center space-x-1.5 truncate">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">
                      {dmTargetProfile.firstName} {dmTargetProfile.lastName}
                    </h3>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-[var(--bg-card-subtle)] text-[var(--text-muted)] shrink-0 border border-[var(--border-color)]">
                      {dmTargetProfile.role}
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] truncate">
                    {dmTargetProfile.designation || 'Team Member'} • {dmTargetProfile.department}
                  </p>
                </div>
              </div>
            ) : activeChatChannel === 'support' ? (
              <div className="flex items-center space-x-2.5 truncate">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 font-bold text-xs flex items-center justify-center border border-indigo-500/30 shrink-0">
                  <Headphones className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="truncate">
                  <div className="flex items-center space-x-1.5">
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">#support</h3>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-indigo-500/20 text-indigo-300">
                      Common Support Helpdesk
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] truncate">
                    HR, payroll, workplace IT, and organizational assistance
                  </p>
                </div>
              </div>
            ) : (
              <div className="truncate">
                <div className="flex items-center space-x-1.5 truncate">
                  {activeChannelObj?.isPrivate ? (
                    <Lock className="w-4 h-4 text-amber-500 font-bold shrink-0" />
                  ) : (
                    <Hash className="w-4 h-4 text-blue-500 font-bold shrink-0" />
                  )}
                  <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">
                    {activeChannelObj?.name || activeChatChannel}
                  </h3>
                  {activeChannelObj?.isPrivate && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 uppercase shrink-0 border border-amber-500/30">
                      Private
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[var(--text-muted)] truncate">
                  {activeChannelObj?.description || 'Team discussion channel'}
                  {activeChannelObj?.createdByName ? ` • Created by ${activeChannelObj.createdByName}` : ''}
                </p>
              </div>
            )}
          </div>

          {/* Header Controls: Settings/Members, Search, Popout, Close */}
          <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0 text-[var(--text-secondary)]">
            {/* Channel Settings & Members Button (for non-DMs) */}
            {!isDirectMessage && activeChannelObj && (
              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card-subtle)] hover:bg-[var(--bg-card)] text-[var(--text-primary)] text-xs font-semibold transition"
                title="Channel Settings & Members"
              >
                <Settings className="w-3.5 h-3.5 text-blue-500" />
                <span className="hidden sm:inline text-[11px]">Settings</span>
                {activeChannelObj.memberIds && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-blue-500/20 text-blue-400">
                    {activeChannelObj.memberIds.length}
                  </span>
                )}
              </button>
            )}

            {/* Search messages toggle */}
            <button
              onClick={() => setShowSearchMessages(!showSearchMessages)}
              className={`p-1.5 rounded-lg border transition ${
                showSearchMessages
                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                  : 'hover:bg-[var(--bg-card-subtle)] border-transparent'
              }`}
              title="Search messages"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Pop out to Standalone Browser Window */}
            <button
              onClick={handlePopoutToSeparateWindow}
              className="p-1.5 hover:bg-[var(--bg-card-subtle)] rounded-lg transition text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              title="Open in Standalone Pop-out Window"
            >
              <ExternalLink className="w-4 h-4" />
            </button>

            {/* Toggle Floating Widget / Maximize */}
            {isWidgetMode ? (
              <>
                {onMaximizeWidget && (
                  <button
                    onClick={onMaximizeWidget}
                    className="p-1.5 hover:bg-[var(--bg-card-subtle)] rounded-lg transition text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    title="Maximize to Full Page"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                )}
                {onCloseWidget && (
                  <button
                    onClick={onCloseWidget}
                    className="p-1.5 hover:bg-[var(--bg-card-subtle)] rounded-lg transition text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    title="Minimize Widget"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={onCloseWidget}
                className="hidden sm:flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[var(--bg-card-subtle)] hover:bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] text-xs font-semibold transition"
                title="Pop out as Floating Widget"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="text-[11px]">Widget Mode</span>
              </button>
            )}
          </div>
        </div>

        {/* Device Notification Prompt Banner */}
        {showNotifBanner && notifPermission === 'default' && (
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 flex items-center justify-between text-xs animate-in slide-in-from-top-2 duration-150 shrink-0">
            <div className="flex items-center space-x-2">
              <BellRing className="w-4 h-4 shrink-0 animate-bounce" />
              <span>
                <strong>Stay Connected:</strong> Enable device notifications to get alerts for messages and <strong>@mentions</strong> on your phone or desktop.
              </span>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={handleRequestNotifications}
                className="px-3 py-1 bg-white text-blue-700 font-bold rounded-lg text-xs hover:bg-blue-50 transition shadow-xs"
              >
                Enable
              </button>
              <button
                onClick={() => setShowNotifBanner(false)}
                className="text-white/80 hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Search messages filter bar */}
        {showSearchMessages && (
          <div className="p-2.5 bg-[var(--bg-card-subtle)] border-b border-[var(--border-color)] flex items-center space-x-2 animate-in fade-in duration-150 shrink-0">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <input
              type="text"
              autoFocus
              value={filterMessageQuery}
              onChange={(e) => setFilterMessageQuery(e.target.value)}
              placeholder="Search conversation text, sender, or attachments..."
              className="flex-1 bg-transparent text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
            />
            {filterMessageQuery && (
              <button
                onClick={() => setFilterMessageQuery('')}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Scrollable Message History Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {displayedMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[var(--text-muted)]">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-3 shadow-xs border border-blue-500/20">
                {activeChatChannel === 'support' ? (
                  <Headphones className="w-6 h-6 text-indigo-400" />
                ) : (
                  <MessageSquare className="w-6 h-6" />
                )}
              </div>
              <h4 className="text-sm font-bold text-[var(--text-primary)]">
                {activeChatChannel === 'support' ? 'Common Support & Helpdesk' : 'No Messages Yet'}
              </h4>
              <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xs">
                {isDirectMessage
                  ? `Say hello to ${dmTargetProfile?.firstName || 'colleague'}! Type @ to mention colleagues or send an attachment.`
                  : activeChatChannel === 'support'
                  ? 'Ask HR, management, or IT for assistance here. Monitored by organization administrators.'
                  : `Start the conversation in #${activeChatChannel}! Type @ to mention members.`}
              </p>
            </div>
          ) : (
            displayedMessages.map((msg) => {
              const isMe = msg.senderId === currentProfile.id;

              return (
                <div
                  key={msg.id}
                  className={`flex items-start space-x-2.5 group ${
                    isMe ? 'flex-row-reverse space-x-reverse' : ''
                  }`}
                >
                  {/* Sender Avatar */}
                  <div
                    className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center shrink-0 border shadow-xs ${
                      isMe
                        ? 'bg-blue-600 text-white border-blue-700'
                        : 'bg-gradient-to-tr from-slate-200 to-slate-100 text-slate-700 border-slate-300 dark:from-slate-700 dark:to-slate-800 dark:text-slate-200 dark:border-slate-600'
                    }`}
                  >
                    {msg.senderName[0]}
                  </div>

                  {/* Bubble Content */}
                  <div className={`max-w-[85%] sm:max-w-lg ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                    {/* Sender Meta */}
                    <div className="flex items-center space-x-1.5 mb-1 px-1 text-[11px]">
                      <span className="font-bold text-[var(--text-primary)] text-[11px]">{msg.senderName}</span>
                      <span className="px-1.5 py-0.2 rounded text-[8px] font-bold uppercase bg-[var(--bg-card-subtle)] text-[var(--text-muted)] border border-[var(--border-color)]">
                        {msg.senderRole}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {formatISTTime(msg.createdAt)} IST
                      </span>
                    </div>

                    {/* Quoted Reply context if any */}
                    {msg.replyToSnippet && (
                      <div
                        className={`text-[10px] px-2.5 py-1 mb-1 rounded-lg border-l-2 max-w-full truncate ${
                          isMe
                            ? 'bg-blue-500/20 border-blue-400 text-blue-200'
                            : 'bg-[var(--bg-card-subtle)] border-slate-400 text-[var(--text-secondary)]'
                        }`}
                      >
                        <span className="font-semibold block truncate">↳ {msg.replyToSnippet}</span>
                      </div>
                    )}

                    {/* Message Card */}
                    <div
                      className={`p-3.5 rounded-2xl text-xs leading-relaxed transition shadow-xs relative group ${
                        isMe
                          ? 'bg-blue-600 text-white rounded-tr-none'
                          : 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-tl-none'
                      }`}
                    >
                      {/* Message text with dynamic @mention formatting */}
                      {msg.message && (
                        <p className="whitespace-pre-line break-words">
                          {renderMessageContent(msg.message)}
                        </p>
                      )}

                      {/* Attachments rendering */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {msg.attachments.map((att) => (
                            <div key={att.id} className="rounded-xl overflow-hidden">
                              {/* 1. Image Preview */}
                              {att.category === 'image' && (
                                <div
                                  onClick={() => setLightboxImage({ url: att.url, name: att.name })}
                                  className="cursor-pointer group/img relative rounded-xl overflow-hidden border border-black/10 max-w-sm"
                                >
                                  <img
                                    src={att.url}
                                    alt={att.name}
                                    className="max-h-60 w-auto object-cover rounded-xl transition group-hover/img:scale-102"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center text-white text-xs font-bold">
                                    Click to Enlarge
                                  </div>
                                </div>
                              )}

                              {/* 2. Video Player */}
                              {att.category === 'video' && (
                                <div className="rounded-xl overflow-hidden border border-[var(--border-color)] max-w-md bg-black/20">
                                  <video controls src={att.url} className="w-full max-h-64 rounded-xl" />
                                  <div className="p-1.5 text-[10px] text-[var(--text-muted)] font-mono truncate flex items-center space-x-1">
                                    <Film className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{att.name}</span>
                                    <span>({formatFileSize(att.size)})</span>
                                  </div>
                                </div>
                              )}

                              {/* 3. Audio Player */}
                              {att.category === 'audio' && (
                                <div className="p-2 bg-[var(--bg-card-subtle)] rounded-xl border border-[var(--border-color)] max-w-xs">
                                  <div className="text-[10px] font-bold text-[var(--text-primary)] flex items-center space-x-1 mb-1">
                                    <Volume2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                    <span className="truncate">{att.name}</span>
                                  </div>
                                  <audio controls src={att.url} className="w-full h-8" />
                                </div>
                              )}

                              {/* 4. Document / Generic File Card */}
                              {(att.category === 'document' || att.category === 'other') && (
                                <div
                                  className={`p-2.5 rounded-xl border flex items-center justify-between space-x-3 transition ${
                                    isMe
                                      ? 'bg-blue-700/60 border-blue-400 text-white'
                                      : 'bg-[var(--bg-card-subtle)] border-[var(--border-color)] text-[var(--text-primary)]'
                                  }`}
                                >
                                  <div className="flex items-center space-x-2 truncate">
                                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                                      <FileText className="w-4 h-4" />
                                    </div>
                                    <div className="truncate">
                                      <span className="font-bold text-xs block truncate">{att.name}</span>
                                      <span className="text-[10px] opacity-75 block">{formatFileSize(att.size)}</span>
                                    </div>
                                  </div>
                                  <a
                                    href={att.url}
                                    download={att.name}
                                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-current border border-white/20 hover:shadow-xs transition shrink-0"
                                    title="Download File"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Slack-style Floating Action Toolbar on Message Hover */}
                      <div
                        className={`absolute -top-3.5 ${
                          isMe ? 'left-2' : 'right-2'
                        } hidden group-hover:flex items-center space-x-0.5 bg-[var(--bg-card)] border border-[var(--border-color)] px-1 py-0.5 rounded-full shadow-lg z-10`}
                      >
                        {['👍', '❤️', '🚀', '🎉', '🔥'].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => addChatReaction(msg.id, emoji)}
                            className="p-1 hover:bg-[var(--bg-card-subtle)] rounded text-xs transition"
                            title={`React with ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                        <button
                          onClick={() =>
                            setReplyingTo({ id: msg.id, senderName: msg.senderName, snippet: msg.message })
                          }
                          className="p-1 hover:bg-[var(--bg-card-subtle)] rounded text-[var(--text-muted)] hover:text-blue-500 transition"
                          title="Reply in thread"
                        >
                          <CornerUpLeft className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => copyMessageText(msg.message)}
                          className="p-1 hover:bg-[var(--bg-card-subtle)] rounded text-[var(--text-muted)] hover:text-blue-500 transition"
                          title="Copy text"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Reaction Badges */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 px-1">
                        {msg.reactions.map((r, idx) => {
                          const hasReacted = r.userIds.includes(currentProfile.id);
                          return (
                            <button
                              key={idx}
                              onClick={() => addChatReaction(msg.id, r.emoji)}
                              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition ${
                                hasReacted
                                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                                  : 'bg-[var(--bg-card-subtle)] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
                              }`}
                            >
                              <span>{r.emoji}</span>
                              <span>{r.count}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input & Attachment Composer */}
        <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-card)] shrink-0 relative">
          {/* @mentions Autocomplete Popover */}
          {showMentionPopover && mentionCandidates.length > 0 && (
            <div className="absolute bottom-full left-3 mb-2 w-72 max-h-56 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-y-auto z-30 p-1.5 animate-in slide-in-from-bottom-2 duration-150">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center space-x-1 border-b border-[var(--border-color)] mb-1">
                <AtSign className="w-3 h-3 text-blue-500" />
                <span>Mention Team Member</span>
              </div>
              <div className="space-y-0.5">
                {mentionCandidates.map((candidate, idx) => {
                  const isSelected = idx === mentionIndex;
                  return (
                    <div
                      key={candidate.id}
                      onClick={() => insertMention(candidate)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer transition text-xs ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'hover:bg-[var(--bg-card-subtle)] text-[var(--text-primary)]'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <span
                          className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-blue-500/20 text-blue-400'
                          }`}
                        >
                          {candidate.name[0]}
                        </span>
                        <div className="truncate">
                          <span className="font-bold text-xs block truncate">@{candidate.name}</span>
                          <span
                            className={`text-[9px] block truncate ${
                              isSelected ? 'text-blue-100' : 'text-[var(--text-muted)]'
                            }`}
                          >
                            {candidate.designation}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`text-[8px] font-bold uppercase px-1 py-0.2 rounded shrink-0 ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-[var(--bg-card-subtle)] text-[var(--text-muted)]'
                        }`}
                      >
                        {candidate.role}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Replying banner */}
          {replyingTo && (
            <div className="flex items-center justify-between p-2 mb-2 bg-blue-500/15 border border-blue-500/30 rounded-xl text-xs text-blue-300 animate-in fade-in duration-150">
              <div className="flex items-center space-x-2 truncate">
                <CornerUpLeft className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="font-semibold shrink-0">Replying to {replyingTo.senderName}:</span>
                <span className="truncate italic">"{replyingTo.snippet}"</span>
              </div>
              <button
                onClick={() => setReplyingTo(null)}
                className="text-blue-400 hover:text-blue-300 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Pending Attachments Tray */}
          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 p-2 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl animate-in fade-in duration-150">
              {pendingAttachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center space-x-2 px-2.5 py-1 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-xs shadow-2xs"
                >
                  {att.category === 'image' ? (
                    <ImageIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  ) : att.category === 'video' ? (
                    <Film className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  ) : att.category === 'audio' ? (
                    <Volume2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <span className="font-medium text-[var(--text-primary)] truncate max-w-[120px]">{att.name}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">({formatFileSize(att.size)})</span>
                  <button
                    onClick={() => removePendingAttachment(att.id)}
                    className="p-0.5 text-[var(--text-muted)] hover:text-rose-500 rounded transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Quick emoji row */}
          {showEmojiPicker && (
            <div className="flex items-center space-x-1.5 mb-2 p-2 bg-[var(--bg-card-subtle)] rounded-xl border border-[var(--border-color)] animate-in fade-in duration-150 overflow-x-auto">
              <span className="text-[11px] font-bold text-[var(--text-muted)] shrink-0">Emojis:</span>
              <div className="flex items-center space-x-1">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setInputText((prev) => prev + emoji);
                      setShowEmojiPicker(false);
                      textareaRef.current?.focus();
                    }}
                    className="p-1 hover:bg-[var(--bg-card)] rounded text-sm transition"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Composer Box */}
          <form onSubmit={handleSendMessage} className="space-y-2">
            <div className="relative border border-[var(--border-color)] rounded-xl bg-[var(--bg-card-subtle)] focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition">
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  isDirectMessage
                    ? `Message ${dmTargetProfile?.firstName || 'colleague'}... (Type @ to mention, Enter to send)`
                    : activeChatChannel === 'support'
                    ? 'Ask support or report an issue... (Type @ to mention, Enter to send)'
                    : `Message #${activeChatChannel}... (Type @ to mention, Enter to send)`
                }
                className="w-full px-3.5 py-2.5 bg-transparent text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none resize-none max-h-32"
              />

              {/* Composer Toolbar */}
              <div className="px-2.5 pb-2 pt-1 flex items-center justify-between border-t border-[var(--border-color)]/60">
                <div className="flex items-center space-x-1">
                  {/* File Attachment Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 text-[var(--text-muted)] hover:text-blue-500 hover:bg-[var(--bg-card)] rounded-lg transition"
                    title="Attach file, video, image, or document (Max 25MB)"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  {/* Mention @ Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setInputText((prev) => prev + '@');
                      setShowMentionPopover(true);
                      setMentionQuery('');
                      textareaRef.current?.focus();
                    }}
                    className="p-1.5 text-[var(--text-muted)] hover:text-blue-500 hover:bg-[var(--bg-card)] rounded-lg transition"
                    title="Mention a colleague (@name)"
                  >
                    <AtSign className="w-4 h-4" />
                  </button>

                  {/* Emoji Picker Button */}
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-1.5 text-[var(--text-muted)] hover:text-blue-500 hover:bg-[var(--bg-card)] rounded-lg transition"
                    title="Add Emoji"
                  >
                    <Smile className="w-4 h-4" />
                  </button>

                  <span className="text-[10px] text-[var(--text-muted)] pl-1 hidden sm:inline">
                    Max 25MB • Free Cloud Guard
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={(!inputText.trim() && pendingAttachments.length === 0) || isSending}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition shadow-xs flex items-center space-x-1.5 text-xs font-bold"
                >
                  <span>Send</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Modal: Create Channel / Group */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-md bg-[var(--bg-card)] rounded-2xl shadow-2xl overflow-hidden my-6 border border-[var(--border-color)]">
            <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-card-subtle)]">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-[var(--text-primary)]">
                  {isPrivateChannel ? 'Create Private Group' : 'Create Team Channel'}
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateChannelSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-primary)] mb-1">
                  Channel / Group Name *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-[var(--text-muted)] font-bold">#</span>
                  <input
                    type="text"
                    required
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))}
                    placeholder="e.g. engineering, sprint-q4"
                    className="w-full pl-7 pr-3 py-2 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-primary)] mb-1">
                  Description / Purpose
                </label>
                <input
                  type="text"
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  placeholder="What is this channel for?"
                  className="w-full px-3 py-2 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Privacy Toggle */}
              <div className="p-3 bg-[var(--bg-card-subtle)] rounded-xl border border-[var(--border-color)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Lock className="w-4 h-4 text-amber-500" />
                    <div>
                      <span className="text-xs font-bold text-[var(--text-primary)] block">Private Group Channel</span>
                      <span className="text-[10px] text-[var(--text-muted)]">Only invited members can view and post</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isPrivateChannel}
                    onChange={(e) => setIsPrivateChannel(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Member Selection if Private */}
              {isPrivateChannel && (
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-primary)] mb-1">
                    Select Group Members ({selectedMemberIds.length} chosen)
                  </label>
                  <div className="max-h-40 overflow-y-auto space-y-1 p-2 bg-[var(--bg-card-subtle)] rounded-xl border border-[var(--border-color)]">
                    {orgProfiles
                      .filter((p) => p.id !== currentProfile.id)
                      .map((p) => {
                        const isSelected = selectedMemberIds.includes(p.id);
                        return (
                          <div
                            key={p.id}
                            onClick={() => toggleMemberSelection(p.id)}
                            className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition ${
                              isSelected
                                ? 'bg-blue-500/20 text-blue-300'
                                : 'hover:bg-[var(--bg-card)] text-[var(--text-secondary)]'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              <span className="w-5 h-5 rounded-full bg-[var(--bg-card)] text-[var(--text-primary)] text-[9px] font-bold flex items-center justify-center border border-[var(--border-color)]">
                                {p.firstName[0]}
                              </span>
                              <span className="text-xs font-medium">{p.firstName} {p.lastName}</span>
                              <span className="text-[9px] text-[var(--text-muted)]">({p.role})</span>
                            </div>
                            <input
                              type="checkbox"
                              readOnly
                              checked={isSelected}
                              className="w-3.5 h-3.5 rounded text-blue-600"
                            />
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-card-subtle)] font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newChannelName.trim() || isSubmittingChannel}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold transition flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSubmittingChannel ? 'Creating...' : 'Create Channel'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Channel Settings & Member Management */}
      {isSettingsModalOpen && activeChannelObj && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-[var(--bg-card)] rounded-2xl shadow-2xl overflow-hidden my-6 border border-[var(--border-color)]">
            <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-card-subtle)]">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[var(--text-primary)]">
                    #{activeChannelObj.name} Settings
                  </h3>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {activeChannelObj.isPrivate ? 'Private Group' : 'Public Channel'} • Managed by {activeChannelObj.createdByName || 'Organization'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-[var(--border-color)] bg-[var(--bg-card)] px-4">
              <button
                onClick={() => setSettingsTab('members')}
                className={`py-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 ${
                  settingsTab === 'members'
                    ? 'border-blue-500 text-blue-500'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Members ({activeChannelObj.memberIds?.length || orgProfiles.length})</span>
              </button>
              {isChannelCreator && (
                <button
                  onClick={() => setSettingsTab('settings')}
                  className={`py-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 ${
                    settingsTab === 'settings'
                      ? 'border-blue-500 text-blue-500'
                      : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Channel Details</span>
                </button>
              )}
            </div>

            <div className="p-5 text-xs">
              {/* Tab 1: Member Management */}
              {settingsTab === 'members' && (
                <div className="space-y-4">
                  {/* Add New Member Section (Visible to Channel Creator & HR/Superadmin) */}
                  {isChannelCreator && (
                    <div className="p-3 bg-[var(--bg-card-subtle)] rounded-xl border border-[var(--border-color)]">
                      <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1 flex items-center">
                        <UserPlus className="w-3.5 h-3.5 mr-1 text-blue-500" />
                        Add Colleague to #{activeChannelObj.name}
                      </label>
                      <div className="flex items-center space-x-2 mt-1.5">
                        <select
                          value={candidateMemberId}
                          onChange={(e) => setCandidateMemberId(e.target.value)}
                          className="flex-1 px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <option value="">Select a colleague to add...</option>
                          {availableToAddColleagues.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.firstName} {p.lastName} ({p.role} • {p.designation || 'Staff'})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleAddMemberToCurrentChannel}
                          disabled={!candidateMemberId}
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold rounded-xl transition shrink-0"
                        >
                          Add Member
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Channel Members List */}
                  <div>
                    <h4 className="text-[11px] font-bold text-[var(--text-primary)] mb-2 uppercase tracking-wide">
                      Channel Members
                    </h4>
                    <div className="max-h-56 overflow-y-auto space-y-1.5 p-2 bg-[var(--bg-card-subtle)] rounded-xl border border-[var(--border-color)]">
                      {orgProfiles
                        .filter((p) => {
                          if (!activeChannelObj.isPrivate) return true;
                          return channelMemberIds.has(p.id) || p.id === activeChannelObj.createdBy;
                        })
                        .map((member) => {
                          const isCreator = member.id === activeChannelObj.createdBy;
                          const canRemove = isChannelCreator && !isCreator && member.id !== currentProfile.id;

                          return (
                            <div
                              key={member.id}
                              className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-xs"
                            >
                              <div className="flex items-center space-x-2.5 truncate">
                                <span className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-500 text-[10px] font-bold flex items-center justify-center shrink-0 border border-blue-500/30">
                                  {member.firstName[0]}
                                </span>
                                <div className="truncate">
                                  <span className="font-bold text-[var(--text-primary)] block truncate">
                                    {member.firstName} {member.lastName}
                                  </span>
                                  <span className="text-[10px] text-[var(--text-muted)] block truncate">
                                    {member.role} • {member.designation || 'Team Member'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center space-x-2 shrink-0">
                                {isCreator ? (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                    Creator
                                  </span>
                                ) : (
                                  canRemove && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveMemberFromCurrentChannel(member.id)}
                                      className="p-1 hover:bg-rose-500/10 text-rose-500 rounded transition"
                                      title="Remove from channel"
                                    >
                                      <UserMinus className="w-3.5 h-3.5" />
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Channel Settings (Creator & Admin only) */}
              {settingsTab === 'settings' && isChannelCreator && (
                <form onSubmit={handleSaveChannelSettings} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-primary)] mb-1">
                      Channel Name
                    </label>
                    <input
                      type="text"
                      required
                      value={editChannelName}
                      onChange={(e) => setEditChannelName(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-primary)] mb-1">
                      Channel Description
                    </label>
                    <textarea
                      rows={2}
                      value={editChannelDesc}
                      onChange={(e) => setEditChannelDesc(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div className="p-3 bg-[var(--bg-card-subtle)] rounded-xl border border-[var(--border-color)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Lock className="w-4 h-4 text-amber-500" />
                        <div>
                          <span className="text-xs font-bold text-[var(--text-primary)] block">Private Access</span>
                          <span className="text-[10px] text-[var(--text-muted)]">Only invited members can view and post</span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={editIsPrivate}
                        onChange={(e) => setEditIsPrivate(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-[var(--border-color)]">
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Permanently delete #${activeChannelObj.name}?`)) {
                          deleteChatChannel(activeChannelObj.id);
                          setIsSettingsModalOpen(false);
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 font-bold text-xs transition flex items-center space-x-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Channel</span>
                    </button>

                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition"
                    >
                      Save Settings
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Image Zoom Modal */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300 p-1"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.name}
              className="max-h-[80vh] w-auto rounded-2xl shadow-2xl object-contain"
            />
            <div className="mt-3 flex items-center space-x-3 text-white text-xs">
              <span className="font-semibold">{lightboxImage.name}</span>
              <a
                href={lightboxImage.url}
                download={lightboxImage.name}
                onClick={(e) => e.stopPropagation()}
                className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg font-bold flex items-center space-x-1 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
