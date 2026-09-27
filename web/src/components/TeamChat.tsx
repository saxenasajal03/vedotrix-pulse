import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { ChatMessage, Profile, ChatChannel } from '../types';
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
  Globe
} from 'lucide-react';
import { formatISTTime, formatISTDate } from '../lib/serialUtils';

export const TeamChat: React.FC = () => {
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
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // New Group/Channel Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [isPrivateChannel, setIsPrivateChannel] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isSubmittingChannel, setIsSubmittingChannel] = useState(false);

  // Helper to determine if current channel is a DM
  const isDirectMessage = activeChatChannel.startsWith('dm:');
  const dmTargetProfileId = isDirectMessage
    ? activeChatChannel.split(':').find((id) => id !== 'dm' && id !== currentProfile.id)
    : null;
  const dmTargetProfile = dmTargetProfileId
    ? orgProfiles.find((p) => p.id === dmTargetProfileId)
    : null;

  // Find active custom channel info
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

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChannelMessages.length, activeChatChannel]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const text = inputText;
    setInputText('');
    setIsSending(true);

    try {
      await sendChatMessage(
        text,
        activeChatChannel,
        isDirectMessage && dmTargetProfileId ? dmTargetProfileId : undefined
      );
    } catch (err) {
      addToast('Error Sending', 'Message could not be dispatched.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleSelectDm = (targetUser: Profile) => {
    const sortedIds = [currentProfile.id, targetUser.id].sort();
    const dmKey = `dm:${sortedIds[0]}:${sortedIds[1]}`;
    setActiveChatChannel(dmKey);
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

  const QUICK_EMOJIS = ['👍', '❤️', '🚀', '🎉', '🔥', '👀', '💯'];

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

  // Separate standard/public organization channels from custom groups
  const publicChannels = chatChannels.filter((c) => !c.isPrivate && c.type !== 'group');
  const privateGroupChannels = chatChannels.filter((c) => c.isPrivate || c.type === 'group');

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col md:flex-row h-[calc(100vh-140px)] min-h-[580px]">
      {/* 1. Sidebar: Channels & Direct Messages List */}
      <div className="w-full md:w-72 lg:w-80 border-r border-slate-100 flex flex-col bg-slate-50/50 shrink-0">
        {/* Channel Search & Header */}
        <div className="p-3.5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-900 tracking-tight">Organization Chat</h2>
                <p className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">
                  {currentOrg.name}
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-blue-100 text-blue-700 uppercase">
              Live DB
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchContact}
              onChange={(e) => setSearchContact(e.target.value)}
              placeholder="Search colleagues..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Scrollable Channels & DMs */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {/* Organization Channels (including Common Support) */}
          <div>
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Organization Channels</span>
              <span className="text-[9px] font-semibold text-slate-500">{publicChannels.length}</span>
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
                    onClick={() => setActiveChatChannel(ch.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition text-left ${
                      isActive
                        ? isSupport ? 'bg-indigo-600 text-white shadow-xs' : 'bg-blue-600 text-white shadow-xs'
                        : isSupport
                        ? 'text-indigo-700 hover:bg-indigo-50/60 font-bold'
                        : 'text-slate-700 hover:bg-white hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      {isSupport ? (
                        <Headphones className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-indigo-600'}`} />
                      ) : (
                        <Hash className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      )}
                      <span className="truncate">{ch.name}</span>
                      {isSupport && (
                        <span className={`text-[8px] px-1 py-0.2 rounded font-extrabold uppercase ${
                          isActive ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'
                        }`}>
                          Helpdesk
                        </span>
                      )}
                    </div>
                    {unread > 0 && !isActive && (
                      <span className="w-2 h-2 rounded-full bg-blue-600" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Groups & Private Channels */}
          <div>
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Groups & Private Channels</span>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center space-x-1 px-1.5 py-0.5 text-[9px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition"
                title="Create Group or Private Channel"
              >
                <Plus className="w-3 h-3" />
                <span>New</span>
              </button>
            </div>
            <div className="space-y-0.5 mt-1">
              {privateGroupChannels.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-slate-400 italic">
                  No groups yet. Click + New to create one!
                </div>
              ) : (
                privateGroupChannels.map((ch) => {
                  const isActive = activeChatChannel === ch.id;
                  const unread = chatMessages.filter(
                    (m) => m.channel === ch.id && m.senderId !== currentProfile.id
                  ).length;

                  return (
                    <button
                      key={ch.id}
                      onClick={() => setActiveChatChannel(ch.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition text-left ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-700 hover:bg-white hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <Lock className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-amber-500'}`} />
                        <span className="truncate">{ch.name}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        {unread > 0 && !isActive && (
                          <span className="w-2 h-2 rounded-full bg-blue-600" />
                        )}
                        <span className={`text-[8px] px-1 py-0.2 rounded ${
                          isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {ch.memberIds?.length || 1}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Direct Messages (Colleagues) */}
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

                return (
                  <button
                    key={colleague.id}
                    onClick={() => handleSelectDm(colleague)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition text-left ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-700 hover:bg-white hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <div
                          className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center border ${
                            isActive ? 'bg-white/20 text-white border-white/30' : 'bg-slate-200 text-slate-700 border-slate-300'
                          }`}
                        >
                          {colleague.firstName[0]}
                          {colleague.lastName?.[0] || ''}
                        </div>
                        <span
                          className={`w-2 h-2 rounded-full absolute -bottom-0.5 -right-0.5 border border-white ${
                            colleague.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="truncate block text-xs">
                          {colleague.firstName} {colleague.lastName}
                        </span>
                        <span
                          className={`text-[9px] truncate block ${
                            isActive ? 'text-white/70' : 'text-slate-400'
                          }`}
                        >
                          {colleague.designation || colleague.role}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Chat Main Panel */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Active Chat Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            {isDirectMessage && dmTargetProfile ? (
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-200">
                    {dmTargetProfile.firstName[0]}
                    {dmTargetProfile.lastName?.[0] || ''}
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute bottom-0 right-0 border-2 border-white" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      {dmTargetProfile.firstName} {dmTargetProfile.lastName}
                    </h3>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-slate-100 text-slate-600">
                      {dmTargetProfile.role}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {dmTargetProfile.designation || 'Team Member'} • {dmTargetProfile.department}
                  </p>
                </div>
              </div>
            ) : activeChatChannel === 'support' ? (
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-200">
                  <Headphones className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      Common Support Channel
                    </h3>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-indigo-100 text-indigo-700">
                      Helpdesk
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Internal organization support, HR questions, payroll queries & IT tickets
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center space-x-1.5">
                  {activeChannelObj?.isPrivate ? (
                    <Lock className="w-4 h-4 text-amber-500 font-bold" />
                  ) : (
                    <Hash className="w-4 h-4 text-blue-600 font-bold" />
                  )}
                  <h3 className="text-sm font-bold text-slate-900 capitalize">
                    {activeChannelObj?.name || activeChatChannel}
                  </h3>
                  {activeChannelObj?.isPrivate && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-700 uppercase">
                      Private Group
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">
                  {activeChannelObj?.description || 'Discussion channel'}
                  {activeChannelObj?.createdByName ? ` • Created by ${activeChannelObj.createdByName}` : ''}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span className="flex items-center text-[11px] font-medium text-slate-500">
              <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
              IST Sync
            </span>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/30">
          {activeChannelMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center mb-3">
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
            activeChannelMessages.map((msg) => {
              const isMe = msg.senderId === currentProfile.id;

              return (
                <div
                  key={msg.id}
                  className={`flex items-start space-x-2.5 ${isMe ? 'flex-row-reverse space-x-reverse' : ''}`}
                >
                  {/* Sender Avatar */}
                  <div
                    className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 border ${
                      isMe
                        ? 'bg-blue-600 text-white border-blue-700'
                        : 'bg-gradient-to-tr from-slate-200 to-slate-100 text-slate-700 border-slate-300'
                    }`}
                  >
                    {msg.senderName[0]}
                  </div>

                  {/* Bubble Content */}
                  <div className={`max-w-[85%] sm:max-w-md ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
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

                    {/* Message Card */}
                    <div
                      className={`p-3 rounded-2xl text-xs leading-relaxed transition shadow-xs relative group ${
                        isMe
                          ? 'bg-blue-600 text-white rounded-tr-none'
                          : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                      }`}
                    >
                      <p className="whitespace-pre-line break-words">{msg.message}</p>

                      {/* Quick Emoji Reaction Buttons on Hover */}
                      <div
                        className={`absolute -top-3.5 ${
                          isMe ? 'left-2' : 'right-2'
                        } hidden group-hover:flex items-center space-x-0.5 bg-white border border-slate-200 px-1 py-0.5 rounded-full shadow-md z-10`}
                      >
                        {['👍', '❤️', '🚀', '🎉'].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => addChatReaction(msg.id, emoji)}
                            className="p-1 hover:bg-slate-100 rounded text-xs transition"
                          >
                            {emoji}
                          </button>
                        ))}
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

        {/* Message Input Form */}
        <div className="p-3 border-t border-slate-100 bg-white shrink-0">
          {/* Quick emoji row */}
          {showEmojiPicker && (
            <div className="flex items-center space-x-2 mb-2 p-2 bg-slate-50 rounded-xl border border-slate-200 animate-in fade-in duration-150">
              <span className="text-[11px] font-bold text-slate-500">Quick Emojis:</span>
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

          <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition shrink-0"
              title="Add Emoji"
            >
              <Smile className="w-5 h-5" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                isDirectMessage
                  ? `Message ${dmTargetProfile?.firstName || 'colleague'}...`
                  : activeChatChannel === 'support'
                  ? 'Ask support or report an inquiry...'
                  : `Message #${activeChatChannel}...`
              }
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition shadow-xs shrink-0 flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
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
    </div>
  );
};
