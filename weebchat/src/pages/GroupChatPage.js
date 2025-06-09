import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSocket from '../hooks/useSocket';
import useAuth from '../hooks/useAuth';
import MessageItem from '../components/Chat/MessageItem';
import MessageInput from '../components/Chat/MessageInput';
import OnlineUsers from '../components/Chat/OnlineUsers';
import ThreadView from '../components/Chat/ThreadView';
import AdminActions from '../components/Chat/AdminActions';
import CountdownTimer from '../components/Chat/CountdownTimer';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';
import { ADMIN_ACTIONS, REACTION_TYPES } from '../constants';
import { getChatGroupDetails, joinSpecificChatGroup } from '../services/CommunityService';
import { fetchGroupMessagesApi } from '../api/messages';

const GroupChatPage = () => {
    const { communityId, groupId: chatGroupId } = useParams();
    const navigate = useNavigate();
    const { socket, emitEvent, onEvent, isConnecting, connectionError, connectSocket } = useSocket();
    const { user: currentUser } = useAuth();

    // --- State Management ---
    const [messages, setMessages] = useState([]);
    const [onlineUsersMap, setOnlineUsersMap] = useState(new Map()); // Map userId -> {id, full_name, profilePic}
    const [typingUserIds, setTypingUserIds] = useState(new Set()); // Using Set for efficient add/remove
    const [replyToMessage, setReplyToMessage] = useState(null); // State for reply context
    const [currentThread, setCurrentThread] = useState({ id: null, parentMessage: null }); // State for active thread
    const [isThreadViewOpen, setIsThreadViewOpen] = useState(false); // State for thread modal visibility
    const [selectedUserForAdmin, setSelectedUserForAdmin] = useState(null);

    const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
    const [isCurrentUserGroupModerator, setIsCurrentUserGroupModerator] = useState(false);

    const [activeCountdowns, setActiveCountdowns] = useState([]);
    const [pageError, setPageError] = useState(null);
    const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
    const [slowModeActive, setSlowModeActive] = useState(false);
    const [chatGroupName, setChatGroupName] = useState('');
    const [isUserChatGroupMember, setIsUserChatGroupMember] = useState(false);

    const messagesEndRef = useRef(null);
    const hasJoinedSocketRoomRef = useRef(false);

    // --- 1. Load Initial Data (REST API Calls) ---
    // This effect runs once on mount, or when chatGroupId/currentUser changes.
    useEffect(() => {
        let isMounted = true;

        const loadData = async () => {
            if (!currentUser || !chatGroupId) {
                if (isMounted) {
                    setIsLoadingInitialData(false);
                    setPageError({ message: "User data or chat group ID missing. Please log in." });
                }
                return;
            }

            setIsLoadingInitialData(true);
            setPageError(null);

            try {
                // 1. Fetch group details
                const groupDetails = await getChatGroupDetails(chatGroupId);
                if (!groupDetails) {
                    if (isMounted) setPageError({ message: "Chat group not found." });
                    return;
                }
                if (isMounted) {
                    setChatGroupName(groupDetails.title);
                    setIsUserChatGroupMember(groupDetails.isJoined);
                    setIsCurrentUserAdmin(currentUser.role === 'admin' || currentUser.id === groupDetails.creatorId);
                }

                // 2. Auto-join if not a member
                if (!groupDetails.isJoined) {
                    console.log(`User ${currentUser.id} not a member of chat group ${chatGroupId}. Attempting to join via REST API.`);
                    try {
                        await joinSpecificChatGroup(chatGroupId);
                        if (isMounted) setIsUserChatGroupMember(true);
                        console.log(`Successfully joined chat group ${chatGroupId} via REST API.`);
                    } catch (joinErr) {
                        console.error(`Failed to join chat group ${chatGroupId} via REST API:`, joinErr);
                        if (isMounted) setPageError({ message: `Failed to join chat group: ${joinErr.response?.data?.message || joinErr.message}` });
                        return; // Stop if membership fails
                    }
                }

                // 3. Fetch initial messages
                const initialMessages = await fetchGroupMessagesApi(chatGroupId);
                if (isMounted) setMessages(initialMessages);

            } catch (err) {
                console.error("Error loading chat group initial data:", err);
                if (isMounted) setPageError({ message: `Error loading chat data: ${err.response?.data?.message || err.message}` });
            } finally {
                if (isMounted) setIsLoadingInitialData(false);
            }
        };

        loadData();

        return () => {
            isMounted = false;
        };
    }, [chatGroupId, currentUser, navigate]);

    // --- 2. Socket.IO Room Joining & Real-time Listener Setup ---
    // This effect handles emitting 'joinGroup' and setting up ALL socket listeners.
    useEffect(() => {
        let isMounted = true;

        // Condition check to emit 'joinGroup'
        if (!isLoadingInitialData && socket && socket.connected && isUserChatGroupMember && !hasJoinedSocketRoomRef.current) {
            console.log(`[GroupChatPage] Socket connected and user is member. Emitting 'joinGroup' for ${chatGroupId}.`);
            hasJoinedSocketRoomRef.current = true; // Mark as attempting/succeeded to join

            emitEvent('joinGroup', { chatGroupId: chatGroupId }, {
                onSuccess: () => {
                    if (isMounted) {
                        console.log(`[GroupChatPage] Successfully emitted 'joinGroup' for ${chatGroupId}.`);
                        setPageError(null); // Clear any general errors
                    }
                },
                onError: (err) => {
                    console.error(`[GroupChatPage] Failed to emit 'joinGroup' for ${chatGroupId}:`, err);
                    if (isMounted) setPageError({ message: `Failed to join chat room: ${err.message || "Unknown error"}` });
                    hasJoinedSocketRoomRef.current = false; // Reset ref if emission fails
                }
            });
        }

        // --- Setup Socket Listeners ---
        // This part runs whenever the socket connection status or chatGroupId changes,
        // and only if the socket is connected.
        let cleanupFunctions = [];
        if (socket && socket.connected) {
            console.log(`[GroupChatPage] Setting up socket listeners for ${chatGroupId}.`);

            cleanupFunctions = [
                onEvent('userPresence', (data) => {
                    if (data.chatGroupId === chatGroupId) {
                        // Backend now sends full user objects in data.onlineUsers
                        setOnlineUsersMap(new Map(data.onlineUsers.map(u => [u.id, u])));
                    }
                }),
                onEvent('newMessage', (newMessage) => {
                    if (newMessage.groupId === chatGroupId) {
                        setMessages(prev => [...prev, { ...newMessage, reactions: [] }]);
                    }
                }),
                onEvent('newReaction', (reaction) => {
                    setMessages(prev => prev.map(msg => {
                        if (msg.id === reaction.messageId && msg.groupId === chatGroupId) {
                            const existingReactions = msg.reactions || [];
                            const userReactedIndex = existingReactions.findIndex(r =>
                                r.userId === reaction.userId &&
                                r.reactionType === reaction.reactionType &&
                                r.customEmote === reaction.customEmote
                            );
                            if (userReactedIndex > -1) return msg;
                            return { ...msg, reactions: [...existingReactions, reaction] };
                        }
                        return msg;
                    }));
                    if (isThreadViewOpen && currentThread.parentMessage?.id === reaction.messageId) {
                        setCurrentThread(prev => ({
                            ...prev,
                            parentMessage: {
                                ...prev.parentMessage,
                                reactions: [...(prev.parentMessage.reactions || []), reaction]
                            }
                        }));
                    }
                }),
                onEvent('threadCreated', (threadData) => {
                    if (threadData.chatGroupId === chatGroupId) {
                        setMessages(prev => prev.map(msg =>
                            msg.id === threadData.parentMessageId
                                ? { ...msg, threadId: threadData.id, hasRepliesCount: (msg.hasRepliesCount || 0) + (threadData.initialMessage ? 1 : 0) }
                                : msg
                        ));
                        if (currentThread.parentMessage?.id === threadData.parentMessageId && !currentThread.id) {
                            setCurrentThread(prev => ({ ...prev, id: threadData.id }));
                        }
                    }
                }),
                onEvent('adminActionPerformed', (data) => {
                    if (data.chatGroupId === chatGroupId) {
                        const actionMessages = {
                            [ADMIN_ACTIONS.SLOW_MODE]: `Slow mode enabled for user for ${data.duration} seconds`,
                            [ADMIN_ACTIONS.MUTE]: `User muted for ${data.duration} seconds`,
                            [ADMIN_ACTIONS.EXILE]: `User sent to timeout room for ${data.duration} seconds`,
                            [ADMIN_ACTIONS.REMOVE]: "User removed from this chat group"
                        };
                        const actionMsg = actionMessages[data.action] || data.action;
                        setPageError({ type: 'admin', message: `Admin Action: ${actionMsg}. ${data.reason ? `Reason: ${data.reason}` : ''}`, duration: 5000 });
                        if (data.action === ADMIN_ACTIONS.REMOVE && data.targetUserId === currentUser.id) {
                            alert("You have been removed from this chat group.");
                            navigate(`/community/${communityId}`);
                        }
                        if (data.targetUserId === currentUser.id && data.action === ADMIN_ACTIONS.SLOW_MODE) {
                            setSlowModeActive(true);
                            setTimeout(() => setSlowModeActive(false), data.duration * 1000);
                        }
                    }
                }),
                onEvent('countdownStarted', (data) => {
                    if (data.chatGroupId === chatGroupId) setActiveCountdowns(prev => [...prev, data]);
                }),
                onEvent('countdownEnded', (data) => {
                    if (data.chatGroupId === chatGroupId) {
                        setActiveCountdowns(prev => prev.filter(cd => cd.countdownId !== data.countdownId));
                        setMessages(prev => [...prev, { id: `system-${Date.now()}`, groupId: chatGroupId, senderId: 'system', full_name: 'System', message: `Countdown "${data.title}" has ended!`, createdAt: new Date().toISOString(), isSystem: true }]);
                    }
                }),
                onEvent('quoteMacro', (data) => {
                    if (data.chatGroupId === chatGroupId) {
                        setMessages(prev => [...prev, { id: `macro-${Date.now()}`, groupId: chatGroupId, senderId: data.userId, full_name: data.userName, profilePic: data.userProfilePic, message: data.customText || `Used macro: ${data.macroId}`, macroId: data.macroId, createdAt: new Date(data.timestamp).toISOString(), isMacro: true }]);
                    }
                }),
                onEvent('userTyping', (data) => {
                    if (data.chatGroupId === chatGroupId && data.userId !== currentUser.id) {
                        setTypingUserIds(prev => {
                            const newSet = new Set(prev);
                            if (data.isTyping) {
                                newSet.add(data.userId);
                            } else {
                                newSet.delete(data.userId);
                            }
                            return newSet;
                        });
                    }
                }),
                onEvent('error', (err) => {
                    console.error("[GroupChatPage] Socket error received from backend:", err);
                    const errorMessage = typeof err === 'string' ? err : (err.message || "Unknown error");
                    setPageError({ message: `Chat Error: ${errorMessage}` });
                    if (errorMessage.includes("Slow mode is enabled")) {
                        setSlowModeActive(true);
                        const durationMatch = errorMessage.match(/(\d+)s/);
                        const duration = durationMatch ? parseInt(durationMatch[1], 10) : 30;
                        setTimeout(() => setSlowModeActive(false), duration * 1000);
                    }
                })
            ];
        }

        // Cleanup: remove all listeners when component unmounts or dependencies change
        return () => {
            if (isMounted) {
                // On component unmount or if dependencies change, and socket was joined, reset ref
                if (socket && socket.connected && hasJoinedSocketRoomRef.current) {
                    hasJoinedSocketRoomRef.current = false;
                }
                cleanupFunctions.forEach(off => off()); // Run all unsubscribe functions
            }
        };
    }, [socket, socket?.connected, chatGroupId, currentUser, isUserChatGroupMember, isThreadViewOpen, currentThread.parentMessage?.id, navigate, communityId, onEvent, isLoadingInitialData]);

    // --- Auto-scroll to bottom ---
    useEffect(() => {
        if (messages.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    // --- Auto-dismiss page errors ---
    useEffect(() => {
        if (pageError?.duration) {
            const timer = setTimeout(() => {
                setPageError(null);
            }, pageError.duration);
            return () => clearTimeout(timer);
        }
    }, [pageError]);

    // --- Handlers ---
    const handleSendMessage = useCallback((messageData) => {
        if (!isUserChatGroupMember || slowModeActive || !socket?.connected) {
            setPageError({ message: "You are not allowed to send messages right now." });
            return;
        }
        const enrichedData = { ...messageData, chatGroupId: chatGroupId, replyTo: replyToMessage ? { messageId: replyToMessage.id } : null };
        emitEvent('sendMessage', enrichedData, { onError: (err) => setPageError({ message: `Failed to send message: ${err.message || "Unknown error"}` }) });
        
        // --- Fix for Reply Feature: Clear reply context after sending message ---
        if (replyToMessage) {
            setReplyToMessage(null); 
        }
    }, [socket, emitEvent, chatGroupId, replyToMessage, slowModeActive, isUserChatGroupMember]);

    const handleReply = useCallback((messageToReply) => {
        setReplyToMessage(messageToReply); // This will correctly set the reply context
        // Ensure other contexts are cleared when starting a new reply
        setCurrentThread({ id: null, parentMessage: null });
        setIsThreadViewOpen(false);
    }, []);

    const handleStartThread = useCallback((parentMsg, openExisting = false) => {
        setCurrentThread({ id: parentMsg.threadId || null, parentMessage: parentMsg });
        setIsThreadViewOpen(true);

        // --- Fix for Thread Creation: Pass chatGroupId in createThread event ---
        if (!parentMsg.threadId && !openExisting) {
            emitEvent('createThread', { parentMessageId: parentMsg.id, chatGroupId: chatGroupId }); // Pass chatGroupId
        } else if (openExisting && parentMsg.threadId) {
            setCurrentThread({ id: parentMsg.threadId, parentMessage: parentMsg });
        }
    }, [emitEvent, chatGroupId]);

    const handleAddReaction = useCallback((messageId, reactionType, customEmote = null) => {
        if (!isUserChatGroupMember) { setPageError({ message: "You are not a member of this chat group. Cannot add reaction." }); return; }
        if (!Object.values(REACTION_TYPES).includes(reactionType) && !customEmote) { setPageError({ message: "Invalid reaction type. Please choose a valid reaction or custom emote." }); return; }
        emitEvent('addReaction', { messageId, reactionType, customEmote });
    }, [emitEvent, isUserChatGroupMember]);

    const handleStartCountdown = useCallback(() => {
        if (!isCurrentUserAdmin && !isCurrentUserGroupModerator) { setPageError({ message: "You don't have privileges to start countdowns." }); return; }
        const duration = parseInt(prompt("Enter countdown duration in seconds:", "30"), 10);
        if (isNaN(duration) || duration <= 0) { alert("Please enter a valid positive number for duration."); return; }
        const title = prompt("Enter countdown title (optional):", "Event Countdown");
        emitEvent('startCountdown', { chatGroupId: chatGroupId, duration, title: title || "Countdown" });
    }, [emitEvent, chatGroupId, isCurrentUserAdmin, isCurrentUserGroupModerator]);

    const handleSendQuoteMacro = useCallback(() => {
        if (!isUserChatGroupMember) { setPageError({ message: "You are not a member of this chat group. Cannot send quote macro." }); return; }
        const macroId = prompt("Enter Macro ID (e.g., 'gg', 'pogchamp'):"); if (!macroId) return;
        const customText = prompt("Enter custom text for macro (optional):");
        emitEvent('sendQuoteMacro', { chatGroupId: chatGroupId, macroId, customText });
    }, [emitEvent, chatGroupId, isUserChatGroupMember]);

    const handleCountdownEnd = useCallback((countdownId) => {
        setActiveCountdowns(prev => prev.filter(cd => cd.countdownId !== countdownId));
    }, []);

    const handleAdminAction = useCallback((action, targetUserId, duration, reason) => {
        if (!isCurrentUserAdmin && !isCurrentUserGroupModerator) { setPageError({ message: "You don't have admin/moderator privileges to perform this action." }); return; }
        emitEvent('adminAction', { chatGroupId: chatGroupId, action, targetUserId, duration: parseInt(duration, 10), reason });
    }, [emitEvent, chatGroupId, isCurrentUserAdmin, isCurrentUserGroupModerator]);

    // --- Typing Status Handling (Handlers passed to MessageInput) ---
    const handleStartTyping = useCallback(() => {
        // Emit 'startTyping' only if user is a member and socket is connected
        if (isUserChatGroupMember && socket?.connected) { 
            emitEvent('startTyping', { chatGroupId: chatGroupId }); 
        }
    }, [emitEvent, chatGroupId, isUserChatGroupMember, socket]);

    const handleStopTyping = useCallback(() => {
        // Emit 'stopTyping' only if user is a member and socket is connected
        if (isUserChatGroupMember && socket?.connected) { 
            emitEvent('stopTyping', { chatGroupId: chatGroupId }); 
        }
    }, [emitEvent, chatGroupId, isUserChatGroupMember, socket]);

    const getTypingUsersNames = useCallback(() => {
        if (typingUserIds.size === 0) return '';
        const typingNames = Array.from(typingUserIds)
                               .map(id => onlineUsersMap.get(id)?.full_name || `User ${id}`)
                               .filter(Boolean); // Filter out any undefined/null names

        if (typingNames.length === 0) return '';
        if (typingNames.length === 1) return `${typingNames[0]} is typing...`;
        if (typingNames.length === 2) return `${typingNames[0]} and ${typingNames[1]} are typing...`;
        return `Several people are typing...`;
    }, [typingUserIds, onlineUsersMap]);

    // --- Rendering ---
    if (isLoadingInitialData) return <LoadingSpinner text="Loading chat..." />;
    if (!currentUser) return <p style={{textAlign: 'center'}}>Please login to chat.</p>;
    if (pageError && !pageError.isSocketError) return (
        <Modal isOpen={true} onClose={() => setPageError(null)} title="Chat Error">
            <p>{pageError.message}</p>
        </Modal>
    );

    return (
        <div className="group-chat-page" style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
            {/* Display persistent socket connection errors */}
            {connectionError && (
                 <Modal isOpen={true} onClose={() => setPageError(null)} title="Connection Problem">
                     <p>Socket connection is unstable: {connectionError.message}. Attempting to reconnect...</p>
                     <button onClick={connectSocket}>Force Reconnect</button>
                 </Modal>
             )}

            {isThreadViewOpen && currentThread.parentMessage && (
                <ThreadView
                    threadId={currentThread.id}
                    parentMessage={currentThread.parentMessage}
                    onClose={() => { setIsThreadViewOpen(false); setCurrentThread({ id: null, parentMessage: null }); }}
                    groupId={chatGroupId} // Pass chatGroupId to ThreadView
                />
            )}

            <div className="chat-main-panel" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', background: '#e5ddd5' }}>
                <div className="chat-header" style={{ padding: '10px', background: '#ededed', borderBottom: '1px solid #ccc' }}>
                    <h3>Chat Group: {chatGroupName || "Loading..."}</h3>
                    <div className="action-buttons">
                        {(isCurrentUserAdmin || isCurrentUserGroupModerator) && (
                            <button onClick={handleStartCountdown} style={{marginLeft: '10px'}}>
                                Start Countdown
                            </button>
                        )}
                        {isUserChatGroupMember && (
                            <button onClick={handleSendQuoteMacro} style={{marginLeft: '10px'}}>
                                Send Quote Macro
                            </button>
                        )}
                    </div>
                </div>

                {activeCountdowns.map(cd => (
                    <CountdownTimer
                        key={cd.countdownId}
                        id={cd.countdownId}
                        title={cd.title}
                        endTime={cd.endTime}
                        onEnd={handleCountdownEnd}
                    />
                ))}

                <div className="messages-list" style={{ flexGrow: 1, overflowY: 'auto', padding: '10px' }}>
                    {!socket?.connected && isConnecting && <LoadingSpinner text="Connecting to chat server..." />}
                    {!socket?.connected && !isConnecting && !isLoadingInitialData && !pageError && <p style={{textAlign: 'center', color: 'red'}}>Disconnected from chat server. Please check your connection.</p>}

                    {messages.length === 0 && !isLoadingInitialData && socket?.connected && (
                        <div className="empty-chat-message" style={{ textAlign: 'center', padding: '20px' }}>
                            <p>No messages yet. Be the first to say something!</p>
                        </div>
                    )}

                    {messages.map(msg => (
                        <MessageItem
                            key={msg.id}
                            message={msg}
                            onReply={handleReply}
                            onStartThread={handleStartThread}
                            onAddReaction={handleAddReaction}
                            currentUserId={currentUser.id}
                            isAdmin={isCurrentUserAdmin || isCurrentUserGroupModerator}
                        />
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {getTypingUsersNames() && (
                    <div style={{ padding: '5px 10px', fontSize: '0.9em', color: '#666', background: '#f0f0f0', borderTop: '1px solid #eee' }}>
                        {getTypingUsersNames()}
                    </div>
                )}

                {isUserChatGroupMember ? (
                    <MessageInput
                        groupId={chatGroupId}
                        onSendMessage={handleSendMessage}
                        replyToMessage={replyToMessage}
                        clearReply={() => setReplyToMessage(null)}
                        disabled={slowModeActive || !socket?.connected}
                        slowModeActive={slowModeActive}
                        onStartTyping={handleStartTyping}
                        onStopTyping={handleStopTyping}
                    />
                ) : (
                    <div style={{ padding: '10px', textAlign: 'center', background: '#fff', borderTop: '1px solid #ccc' }}>
                        <p>You are not a member of this chat group. You must be a member to send messages.</p>
                    </div>
                )}
            </div>

            <div className="chat-sidebar" style={{width: '250px', borderLeft: '1px solid #ccc'}}>
                <OnlineUsers
                    onlineUsersData={Array.from(onlineUsersMap.values())}
                    onUserClick={(isCurrentUserAdmin || isCurrentUserGroupModerator) ? setSelectedUserForAdmin : null}
                    currentUserId={currentUser.id}
                />

                {(isCurrentUserAdmin || isCurrentUserGroupModerator) && selectedUserForAdmin && (
                    <AdminActions
                        groupId={chatGroupId}
                        targetUser={selectedUserForAdmin}
                        currentUserId={currentUser.id}
                        onAdminAction={handleAdminAction}
                    />
                )}
            </div>
        </div>
    );
};

export default GroupChatPage;