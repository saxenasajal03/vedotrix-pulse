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
  Copy
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
    deleteChatChannel,
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

  // Phone responsive screen state: 'sidebar' or 'chat'
  const [mobileScreen, setMobileScreen] = useState<'sidebar' | 'chat'>('chat');

  // Device Notifications State
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [showNotifBanner, setShowNotifBanner] = useState(false);

  // New Channel / Group Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [isPrivateChannel, setIsPrivateChannel] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isSubmittingChannel, setIsSubmittingChannel] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        'You will now receive alerts for incoming messages on your phone & desktop even if the tab is in the background.',
        'success'
      );
    } else {
      addToast(
        'Notifications Restricted',
        'Notification permission was not granted. You can re-enable it in your browser settings.',
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

  // Handle file selection with size guard (max 25MB)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        addToast(
          'File Exceeds 25MB Limit',
          `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)}MB. To protect free cloud storage, max upload size is 25MB.`,
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

    // Reset input
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
    const replyContext = replyingTo ? { id: replyingTo.id, snippet: `${replyingTo.senderName}: ${replyingTo.snippet}` } : undefined;

    setInputText('');
    setPendingAttachments([]);
    setReplyingTo(null);
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
    const popoutUrl = `${currentUrl}#chat-popout`;
    window.open(popoutUrl, 'VedotrixPulseChat', 'width=540,height=780,menubar=no,toolbar=no,location=no,status=no');
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

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col md:flex-row ${
        isWidgetMode
          ? 'h-full w-full'
          : 'h-[calc(100vh-140px)] min-h-[580px]'
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
        } w-full md:w-72 lg:w-80 border-r border-slate-100 flex-col bg-slate-50/70 shrink-0 h-full overflow-hidden`}
      >
        {/* Workspace Brand & Header */}
        <div className="p-3.5 border-b border-slate-200/70 bg-slate-100/50">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center space-x-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs font-bold text-slate-900 tracking-tight truncate">
                  {currentOrg.name}
                </h2>
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-emerald-700 font-semibold">Realtime Connected</span>
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
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                  : 'bg-white border-slate-200 text-slate-500 hover:text-blue-600'
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
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchContact}
              onChange={(e) => setSearchContact(e.target.value)}
              placeholder="Search colleagues or channels..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </div>
        </div>

        {/* Scrollable Channels & DMs */}
        <div className="flex-1 overflow-y-auto p-2 space-y-3.5 text-xs">
          {/* Organization Channels (Sole default is support; user-created channels follow) */}
          <div>
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Organization Channels</span>
              <button
                onClick={() => {
                  setIsPrivateChannel(false);
                  setIsCreateModalOpen(true);
                }}
                className="text-blue-600 hover:text-blue-700 flex items-center space-x-0.5 text-[10px] font-bold hover:underline"
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
                        ? 'text-indigo-700 hover:bg-indigo-50/70 font-bold bg-indigo-50/30'
                        : 'text-slate-700 hover:bg-white hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      {isSupport ? (
                        <Headphones className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-indigo-600'}`} />
                      ) : (
                        <Hash className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      )}
                      <span className="truncate">{ch.name}</span>
                      {isSupport && (
                        <span
                          className={`text-[8px] px-1 py-0.2 rounded font-extrabold uppercase shrink-0 ${
                            isActive ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'
                          }`}
                        >
                          Helpdesk
                        </span>
                      )}
                    </div>
                    {unread > 0 && !isActive && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Groups & Private Channels */}
          <div>
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Private Groups</span>
              <button
                onClick={() => {
                  setIsPrivateChannel(true);
                  setIsCreateModalOpen(true);
                }}
                className="text-amber-600 hover:text-amber-700 flex items-center space-x-0.5 text-[10px] font-bold hover:underline"
              >
                <Plus className="w-3 h-3" />
                <span>Group</span>
              </button>
            </div>
            <div className="space-y-0.5 mt-1">
              {privateGroupChannels.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-slate-400 italic">
                  No private groups created yet.
                </div>
              ) : (
                privateGroupChannels.map((ch) => {
                  const isActive = activeChatChannel === ch.id;
                  const canDelete =
                    isVedotrixSuperadmin ||
                    currentProfile.role === 'superadmin' ||
                    currentProfile.role === 'hr' ||
                    ch.createdBy === currentProfile.id;

                  return (
                    <div
                      key={ch.id}
                      className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                        isActive
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-slate-700 hover:bg-white hover:text-slate-900'
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
                              isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {ch.memberIds.length}
                          </span>
                        )}
                      </button>

                      {canDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete private group #${ch.name}?`)) {
                              deleteChatChannel(ch.id);
                            }
                          }}
                          className={`opacity-0 group-hover:opacity-100 p-1 rounded transition shrink-0 ${
                            isActive ? 'hover:bg-amber-700 text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-rose-600'
                          }`}
                          title="Delete Group"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Direct Messages with Colleagues */}
          <div>
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Direct Messages</span>
              <span className="text-[9px] font-semibold text-slate-500">{filteredColleagues.length}</span>
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
                        : 'text-slate-700 hover:bg-white hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <div className="relative shrink-0">
                        <div
                          className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-gradient-to-tr from-slate-200 to-slate-100 text-slate-700 border border-slate-300'
                          }`}
                        >
                          {colleague.firstName[0]}
                        </div>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 absolute bottom-0 right-0 border-2 border-white" />
                      </div>
                      <div className="truncate">
                        <span className="block truncate font-medium text-xs">
                          {colleague.firstName} {colleague.lastName}
                        </span>
                        <span
                          className={`block text-[9px] truncate ${
                            isActive ? 'text-blue-100' : 'text-slate-400'
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
        <div className="p-3 border-t border-slate-200/70 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 truncate">
            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
              {currentProfile.firstName[0]}
            </div>
            <div className="truncate">
              <span className="text-xs font-bold text-slate-900 block truncate">
                {currentProfile.firstName} {currentProfile.lastName}
              </span>
              <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wide truncate">
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
        } flex-1 flex flex-col bg-slate-50/30 h-full overflow-hidden`}
      >
        {/* Chat Header Bar */}
        <div className="px-4 py-3 border-b border-slate-200/70 flex items-center justify-between bg-white shrink-0 shadow-xs">
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            {/* Mobile Back Button to Channels */}
            <button
              onClick={() => setMobileScreen('sidebar')}
              className="md:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition flex items-center space-x-0.5 text-xs font-bold shrink-0"
              title="Back to channels"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {isDirectMessage && dmTargetProfile ? (
              <div className="flex items-center space-x-2.5 truncate">
                <div className="relative shrink-0">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-200">
                    {dmTargetProfile.firstName[0]}
                    {dmTargetProfile.lastName?.[0] || ''}
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute bottom-0 right-0 border-2 border-white" />
                </div>
                <div className="truncate">
                  <div className="flex items-center space-x-1.5 truncate">
                    <h3 className="text-sm font-bold text-slate-900 truncate">
                      {dmTargetProfile.firstName} {dmTargetProfile.lastName}
                    </h3>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-slate-100 text-slate-600 shrink-0">
                      {dmTargetProfile.role}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">
                    {dmTargetProfile.designation || 'Team Member'} • {dmTargetProfile.department}
                  </p>
                </div>
              </div>
            ) : activeChatChannel === 'support' ? (
              <div className="flex items-center space-x-2.5 truncate">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-200 shrink-0">
                  <Headphones className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="truncate">
                  <div className="flex items-center space-x-1.5">
                    <h3 className="text-sm font-bold text-slate-900">#support</h3>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-indigo-100 text-indigo-700">
                      Common Support Helpdesk
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">
                    HR, payroll, workplace IT, and organizational inquiries
                  </p>
                </div>
              </div>
            ) : (
              <div className="truncate">
                <div className="flex items-center space-x-1.5 truncate">
                  {activeChannelObj?.isPrivate ? (
                    <Lock className="w-4 h-4 text-amber-500 font-bold shrink-0" />
                  ) : (
                    <Hash className="w-4 h-4 text-blue-600 font-bold shrink-0" />
                  )}
                  <h3 className="text-sm font-bold text-slate-900 truncate">
                    {activeChannelObj?.name || activeChatChannel}
                  </h3>
                  {activeChannelObj?.isPrivate && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-700 uppercase shrink-0">
                      Private
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 truncate">
                  {activeChannelObj?.description || 'Team discussion channel'}
                  {activeChannelObj?.createdByName ? ` • By ${activeChannelObj.createdByName}` : ''}
                </p>
              </div>
            )}
          </div>

          {/* Header Controls: Search, Popout Widget, Maximize, Close */}
          <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0 text-slate-500">
            {/* Search messages toggle */}
            <button
              onClick={() => setShowSearchMessages(!showSearchMessages)}
              className={`p-1.5 rounded-lg border transition ${
                showSearchMessages ? 'bg-blue-50 border-blue-200 text-blue-600' : 'hover:bg-slate-100 border-transparent'
              }`}
              title="Search messages in this channel"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Pop out to Standalone Browser Window */}
            <button
              onClick={handlePopoutToSeparateWindow}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition text-slate-500 hover:text-slate-900"
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
                    className="p-1.5 hover:bg-slate-100 rounded-lg transition text-slate-500 hover:text-slate-900"
                    title="Maximize to Full Page"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                )}
                {onCloseWidget && (
                  <button
                    onClick={onCloseWidget}
                    className="p-1.5 hover:bg-slate-100 rounded-lg transition text-slate-500 hover:text-slate-900"
                    title="Minimize Widget"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={onCloseWidget}
                className="hidden sm:flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
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
                <strong>Stay Connected:</strong> Enable device notifications to get chat alerts on your phone or desktop even when tabs are closed.
              </span>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={handleRequestNotifications}
                className="px-3 py-1 bg-white text-blue-700 font-bold rounded-lg text-xs hover:bg-blue-50 transition shadow-xs"
              >
                Enable Notifications
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
          <div className="p-2.5 bg-slate-100/70 border-b border-slate-200/70 flex items-center space-x-2 animate-in fade-in duration-150 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={filterMessageQuery}
              onChange={(e) => setFilterMessageQuery(e.target.value)}
              placeholder="Search conversation text, sender, or attachments..."
              className="flex-1 bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
            />
            {filterMessageQuery && (
              <button
                onClick={() => setFilterMessageQuery('')}
                className="text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Scrollable Message History Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {displayedMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center mb-3 shadow-xs">
                {activeChatChannel === 'support' ? (
                  <Headphones className="w-6 h-6 text-indigo-600" />
                ) : (
                  <MessageSquare className="w-6 h-6" />
                )}
              </div>
              <h4 className="text-sm font-bold text-slate-700">
                {activeChatChannel === 'support' ? 'Common Support & Helpdesk' : 'No Messages Yet'}
              </h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                {isDirectMessage
                  ? `Say hello to ${dmTargetProfile?.firstName || 'your colleague'}! Send your first direct message.`
                  : activeChatChannel === 'support'
                  ? 'Ask HR, management, or IT for assistance here. All organization support requests are monitored.'
                  : `Start the conversation in #${activeChatChannel}!`}
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
                        : 'bg-gradient-to-tr from-slate-200 to-slate-100 text-slate-700 border-slate-300'
                    }`}
                  >
                    {msg.senderName[0]}
                  </div>

                  {/* Bubble Content */}
                  <div className={`max-w-[85%] sm:max-w-lg ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                    {/* Sender Meta */}
                    <div className="flex items-center space-x-1.5 mb-1 px-1 text-[11px]">
                      <span className="font-bold text-slate-800 text-[11px]">{msg.senderName}</span>
                      <span className="px-1.5 py-0.2 rounded text-[8px] font-bold uppercase bg-slate-100 text-slate-500">
                        {msg.senderRole}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatISTTime(msg.createdAt)} IST
                      </span>
                    </div>

                    {/* Quoted Reply context if any */}
                    {msg.replyToSnippet && (
                      <div
                        className={`text-[10px] px-2.5 py-1 mb-1 rounded-lg border-l-2 max-w-full truncate ${
                          isMe
                            ? 'bg-blue-50 border-blue-400 text-blue-900'
                            : 'bg-slate-100 border-slate-400 text-slate-600'
                        }`}
                      >
                        <span className="font-semibold block truncate">
                          ↳ {msg.replyToSnippet}
                        </span>
                      </div>
                    )}

                    {/* Message Card */}
                    <div
                      className={`p-3.5 rounded-2xl text-xs leading-relaxed transition shadow-xs relative group ${
                        isMe
                          ? 'bg-blue-600 text-white rounded-tr-none'
                          : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none'
                      }`}
                    >
                      {/* Message text */}
                      {msg.message && (
                        <p className="whitespace-pre-line break-words">{msg.message}</p>
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
                                <div className="rounded-xl overflow-hidden border border-black/10 max-w-md bg-black/10">
                                  <video
                                    controls
                                    src={att.url}
                                    className="w-full max-h-64 rounded-xl"
                                  />
                                  <div className="p-1.5 text-[10px] text-slate-500 font-mono truncate flex items-center space-x-1">
                                    <Film className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{att.name}</span>
                                    <span>({formatFileSize(att.size)})</span>
                                  </div>
                                </div>
                              )}

                              {/* 3. Audio Player */}
                              {att.category === 'audio' && (
                                <div className="p-2 bg-slate-100 rounded-xl border border-slate-200/80 max-w-xs">
                                  <div className="text-[10px] font-bold text-slate-700 flex items-center space-x-1 mb-1">
                                    <Volume2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
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
                                      : 'bg-slate-50 border-slate-200 text-slate-800'
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
                                    className="p-1.5 rounded-lg bg-white text-slate-700 hover:text-blue-600 hover:shadow-xs transition shrink-0"
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
                        } hidden group-hover:flex items-center space-x-0.5 bg-white border border-slate-200 px-1 py-0.5 rounded-full shadow-md z-10`}
                      >
                        {['👍', '❤️', '🚀', '🎉', '🔥'].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => addChatReaction(msg.id, emoji)}
                            className="p-1 hover:bg-slate-100 rounded text-xs transition"
                            title={`React with ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                        <button
                          onClick={() => setReplyingTo({ id: msg.id, senderName: msg.senderName, snippet: msg.message })}
                          className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600 transition"
                          title="Reply in thread"
                        >
                          <CornerUpLeft className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => copyMessageText(msg.message)}
                          className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600 transition"
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
                                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
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
        <div className="p-3 border-t border-slate-200/80 bg-white shrink-0">
          {/* Replying banner */}
          {replyingTo && (
            <div className="flex items-center justify-between p-2 mb-2 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900 animate-in fade-in duration-150">
              <div className="flex items-center space-x-2 truncate">
                <CornerUpLeft className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="font-semibold shrink-0">Replying to {replyingTo.senderName}:</span>
                <span className="truncate italic text-blue-700">"{replyingTo.snippet}"</span>
              </div>
              <button
                onClick={() => setReplyingTo(null)}
                className="text-blue-600 hover:text-blue-800 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Pending Attachments Tray */}
          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 p-2 bg-slate-50 border border-slate-200 rounded-xl animate-in fade-in duration-150">
              {pendingAttachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center space-x-2 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs shadow-2xs"
                >
                  {att.category === 'image' ? (
                    <ImageIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  ) : att.category === 'video' ? (
                    <Film className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  ) : att.category === 'audio' ? (
                    <Volume2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  )}
                  <span className="font-medium text-slate-800 truncate max-w-[120px]">{att.name}</span>
                  <span className="text-[10px] text-slate-400">({formatFileSize(att.size)})</span>
                  <button
                    onClick={() => removePendingAttachment(att.id)}
                    className="p-0.5 text-slate-400 hover:text-rose-600 rounded transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Quick emoji row */}
          {showEmojiPicker && (
            <div className="flex items-center space-x-1.5 mb-2 p-2 bg-slate-50 rounded-xl border border-slate-200 animate-in fade-in duration-150 overflow-x-auto">
              <span className="text-[11px] font-bold text-slate-500 shrink-0">Emojis:</span>
              <div className="flex items-center space-x-1">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setInputText((prev) => prev + emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="p-1 hover:bg-white rounded text-sm transition"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Composer Box */}
          <form onSubmit={handleSendMessage} className="space-y-2">
            <div className="relative border border-slate-200 rounded-xl bg-slate-50/60 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition">
              <textarea
                rows={1}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isDirectMessage
                    ? `Message ${dmTargetProfile?.firstName || 'colleague'}... (Enter to send, Shift+Enter for newline)`
                    : activeChatChannel === 'support'
                    ? 'Ask support or report an issue... (Enter to send)'
                    : `Message #${activeChatChannel}... (Enter to send)`
                }
                className="w-full px-3.5 py-2.5 bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none resize-none max-h-32"
              />

              {/* Composer Toolbar */}
              <div className="px-2.5 pb-2 pt-1 flex items-center justify-between border-t border-slate-200/50">
                <div className="flex items-center space-x-1">
                  {/* File Attachment Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-200/70 rounded-lg transition"
                    title="Attach file, video, image, or document (Max 25MB)"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  {/* Emoji Picker Button */}
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-200/70 rounded-lg transition"
                    title="Add Emoji"
                  >
                    <Smile className="w-4 h-4" />
                  </button>

                  <span className="text-[10px] text-slate-400 pl-1 hidden sm:inline">
                    Max 25MB • Free Supabase Guard
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={(!inputText.trim() && pendingAttachments.length === 0) || isSending}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition shadow-xs flex items-center space-x-1.5 text-xs font-bold"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden my-6 border border-slate-100">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-slate-900">
                  {isPrivateChannel ? 'Create Private Group' : 'Create Team Channel'}
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateChannelSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Channel / Group Name *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold">#</span>
                  <input
                    type="text"
                    required
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))}
                    placeholder="e.g. project-apollo, marketing-sync"
                    className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Description / Purpose
                </label>
                <input
                  type="text"
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  placeholder="What is this channel for?"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Privacy Toggle */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Lock className="w-4 h-4 text-amber-500" />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Private Group Channel</span>
                      <span className="text-[10px] text-slate-500">Only invited members can view and post</span>
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
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Select Group Members ({selectedMemberIds.length} chosen)
                  </label>
                  <div className="max-h-40 overflow-y-auto space-y-1 p-2 bg-slate-50 rounded-xl border border-slate-200">
                    {orgProfiles
                      .filter((p) => p.id !== currentProfile.id)
                      .map((p) => {
                        const isSelected = selectedMemberIds.includes(p.id);
                        return (
                          <div
                            key={p.id}
                            onClick={() => toggleMemberSelection(p.id)}
                            className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition ${
                              isSelected ? 'bg-blue-100/70 text-blue-900' : 'hover:bg-white text-slate-700'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[9px] font-bold flex items-center justify-center">
                                {p.firstName[0]}
                              </span>
                              <span className="text-xs font-medium">{p.firstName} {p.lastName}</span>
                              <span className="text-[9px] text-slate-400">({p.role})</span>
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
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition"
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

      {/* Lightbox Image Zoom Modal */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
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
