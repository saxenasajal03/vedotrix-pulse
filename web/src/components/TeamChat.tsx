import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { ChatMessage, Profile } from '../types';
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
  Paperclip
} from 'lucide-react';
import { formatISTTime, formatISTDate } from '../lib/serialUtils';

export const TeamChat: React.FC = () => {
  const {
    currentOrg,
    currentProfile,
    orgProfiles,
    chatMessages,
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

  // Channels definitions
  const CHANNELS = [
    { id: 'general', name: 'general', desc: 'Company-wide updates & team discussion' },
    { id: 'engineering', name: 'engineering', desc: 'Technical sprints, PRs, and deployments' },
    { id: 'operations', name: 'operations', desc: 'Operations, client workflows, and workplace ops' },
    { id: 'announcements', name: 'announcements', desc: 'Official releases & corporate broadcasts' }
  ];

  // Helper to determine if current channel is a DM
  const isDirectMessage = activeChatChannel.startsWith('dm:');
  const dmTargetProfileId = isDirectMessage
    ? activeChatChannel.split(':').find((id) => id !== 'dm' && id !== currentProfile.id)
    : null;
  const dmTargetProfile = dmTargetProfileId
    ? orgProfiles.find((p) => p.id === dmTargetProfileId)
    : null;

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
    // Generate normalized deterministic DM channel key
    const sortedIds = [currentProfile.id, targetUser.id].sort();
    const dmKey = `dm:${sortedIds[0]}:${sortedIds[1]}`;
    setActiveChatChannel(dmKey);
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
          {/* Public Channels */}
          <div>
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Department Channels
            </div>
            <div className="space-y-0.5 mt-1">
              {CHANNELS.map((ch) => {
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
                      <Hash className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span className="truncate">{ch.name}</span>
                    </div>
                    {unread > 0 && !isActive && (
                      <span className="w-2 h-2 rounded-full bg-blue-600" />
                    )}
                  </button>
                );
              })}
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
            ) : (
              <div>
                <div className="flex items-center space-x-1.5">
                  <Hash className="w-4 h-4 text-blue-600 font-bold" />
                  <h3 className="text-sm font-bold text-slate-900 capitalize">
                    {CHANNELS.find((c) => c.id === activeChatChannel)?.name || activeChatChannel}
                  </h3>
                </div>
                <p className="text-[10px] text-slate-400">
                  {CHANNELS.find((c) => c.id === activeChatChannel)?.desc || 'Discussion channel'}
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
                <MessageSquare className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">No Messages Yet</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                {isDirectMessage
                  ? `Say hello to ${dmTargetProfile?.firstName || 'your colleague'}! Send your first direct message.`
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
    </div>
  );
};
