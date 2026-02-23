'use client';

import React, { useState, useEffect } from 'react';
import { useInboxStore } from '@/lib/inbox-store';
import { Platform } from '@/types/inbox';
import { Send, Search, Filter, Facebook, Instagram, Phone, MoreVertical } from 'lucide-react';
import { format } from 'date-fns';

export default function UnifiedInbox() {
    const {
        conversations,
        activeConversationId,
        messages,
        filter,
        setFilter,
        setActiveConversation,
        sendMessage
    } = useInboxStore();

    const [replyText, setReplyText] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        console.log('UnifiedInbox mounted');
    }, []);

    if (!isClient) return <div className="p-8">Loading inbox...</div>;

    const filteredConversations = conversations?.filter(c => {
        const matchesFilter = filter === 'all' || c.platform === filter;
        const matchesSearch = c.participants.some(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesFilter && matchesSearch;
    });

    const activeConversation = conversations.find(c => c.id === activeConversationId);
    const activeMessages = activeConversationId ? messages[activeConversationId] || [] : [];

    // Sort messages by timestamp
    const sortedMessages = [...activeMessages].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyText.trim() || !activeConversationId) return;

        sendMessage(activeConversationId, replyText);
        setReplyText('');
    };

    const getPlatformIcon = (platform: Platform) => {
        switch (platform) {
            case 'facebook': return <Facebook className="w-4 h-4 text-blue-600" />;
            case 'instagram': return <Instagram className="w-4 h-4 text-pink-600" />;
            case 'whatsapp': return <Phone className="w-4 h-4 text-green-600" />;
        }
    };

    return (
        <div className="flex h-[calc(100vh-6rem)] bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            {/* Sidebar - Conversation List */}
            <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 flex flex-col">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Inbox</h2>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setFilter('all')}
                                className={`px-2 py-1 text-xs rounded ${filter === 'all' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setFilter('facebook')}
                                className={`p-1 rounded ${filter === 'facebook' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
                            >
                                <Facebook className="w-3 h-3" />
                            </button>
                            <button
                                onClick={() => setFilter('instagram')}
                                className={`p-1 rounded ${filter === 'instagram' ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-600'}`}
                            >
                                <Instagram className="w-3 h-3" />
                            </button>
                            <button
                                onClick={() => setFilter('whatsapp')}
                                className={`p-1 rounded ${filter === 'whatsapp' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                            >
                                <Phone className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search messages..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {filteredConversations.map(conversation => (
                        <div
                            key={conversation.id}
                            onClick={() => setActiveConversation(conversation.id)}
                            className={`p-4 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${activeConversationId === conversation.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-l-indigo-500' : 'border-l-4 border-l-transparent'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-medium text-gray-900 dark:text-gray-100">{conversation.participants[0].name}</h3>
                                    {getPlatformIcon(conversation.platform)}
                                </div>
                                <span className="text-xs text-gray-500">
                                    {format(new Date(conversation.lastMessage.timestamp), 'MMM d, h:mm a')}
                                </span>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                {conversation.lastMessage.content}
                            </p>
                        </div>
                    ))}
                    {filteredConversations.length === 0 && (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                            No conversations found
                        </div>
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900">
                {activeConversationId && activeConversation ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                                    {activeConversation.participants[0].name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                        {activeConversation.participants[0].name}
                                        {getPlatformIcon(activeConversation.platform)}
                                    </h3>
                                    <span className="text-xs text-gray-500">
                                        via {activeConversation.platform.charAt(0).toUpperCase() + activeConversation.platform.slice(1)}
                                    </span>
                                </div>
                            </div>
                            <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <MoreVertical className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Chat Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {sortedMessages.map((msg, idx) => {
                                const isStaff = msg.isFromStaff;
                                return (
                                    <div key={msg.id} className={`flex ${isStaff ? 'justify-end' : 'justify-start'}`}>
                                        <div
                                            className={`max-w-[70%] rounded-lg px-4 py-2 text-sm ${isStaff
                                                ? 'bg-indigo-600 text-white rounded-br-none'
                                                : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-bl-none shadow-sm'
                                                }`}
                                        >
                                            <p>{msg.content}</p>
                                            <div className={`text-[10px] mt-1 text-right ${isStaff ? 'text-indigo-200' : 'text-gray-400'}`}>
                                                {format(new Date(msg.timestamp), 'h:mm a')}
                                                {isStaff && (
                                                    <span className="ml-1 opacity-70">
                                                        {msg.status === 'read' ? 'avg_checked' : 'check'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                            <form onSubmit={handleSendMessage} className="flex gap-2">
                                <input
                                    type="text"
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    placeholder="Type a reply..."
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                                />
                                <button
                                    type="submit"
                                    disabled={!replyText.trim()}
                                    className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                            <Send className="w-8 h-8 opacity-50" />
                        </div>
                        <p>Select a conversation to start messaging</p>
                    </div>
                )}
            </div>
        </div>
    );
}
