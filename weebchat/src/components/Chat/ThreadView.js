import React, { useState, useEffect, useRef } from 'react';
import useSocket from '../../hooks/useSocket';
import useAuth from '../../hooks/useAuth';
import MessageItem from './MessageItem';
import MessageInput from './MessageInput';
import LoadingSpinner from '../common/LoadingSpinner';

const ThreadView = ({ threadId, parentMessage, onClose, groupId: chatGroupId }) => { // Destructure groupId as chatGroupId
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user: currentUser } = useAuth();
    const { emitEvent, onEvent } = useSocket();
    const messagesEndRef = useRef(null);

    // Initial fetch of thread messages
    useEffect(() => {
        let isMounted = true;
        if (threadId) {
            setLoading(true);
            emitEvent('getThreadMessages', { threadId }); // Backend already handles this

            const cleanup = onEvent('threadMessages', (data) => {
                if (isMounted && data.threadId === threadId) {
                    setMessages(data.messages.map(m => ({
                        ...m,
                        senderId: m.userId,
                    })));
                    setLoading(false);
                }
            });
            return () => {
                isMounted = false;
                cleanup(); // Unsubscribe on cleanup
            };
        }
    }, [threadId, emitEvent, onEvent]);

    // Listen for new messages that belong to this thread
    useEffect(() => {
        let isMounted = true;
        const cleanupNewMessage = onEvent('newMessage', (newMessage) => {
            // A message is part of this thread if it has this `threadId` AND belongs to the same `chatGroupId`
            // `newMessage.groupId` is the alias from backend (chatGroupId column)
            if (isMounted && newMessage.threadId === threadId && newMessage.groupId === chatGroupId) {
                 setMessages(prev => [...prev, { ...newMessage }]);
            }
        });
        return () => {
            isMounted = false;
            cleanupNewMessage(); // Unsubscribe on cleanup
        };
    }, [threadId, chatGroupId, onEvent]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessageInThread = (messageData) => {
        // Add threadId and chatGroupId to the message data for the backend socket event
        emitEvent('sendMessage', {
            ...messageData,
            threadId, // Pass threadId
            chatGroupId: chatGroupId // Pass chatGroupId to backend as `chatGroupId` property
        });
    };

    if (loading) return <LoadingSpinner text="Loading thread messages..." />;

    return (
        <div className="thread-view modal-like" style={{
            position: 'fixed', top: '10%', left: '50%', transform: 'translateX(-50%)',
            width: '80%', maxWidth: '600px', height: '70vh', background: 'white',
            border: '1px solid #ccc', borderRadius: '8px', boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
            display: 'flex', flexDirection: 'column', zIndex: 1001
        }}>
            <div style={{ padding: '15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
                <h3>Thread (Replying to {parentMessage?.full_name || 'message'})</h3>
                <button onClick={onClose} style={{background:'transparent', border:'none', fontSize:'1.5em', cursor:'pointer'}}>×</button>
            </div>

            <div className="messages-list" style={{ flexGrow: 1, overflowY: 'auto', padding: '10px' }}>
                {/* Display parent message context */}
                {parentMessage && (
                    <>
                        <MessageItem
                            message={parentMessage}
                            onReply={() => {}} // No replies to parent from thread view
                            onStartThread={() => {}} // No new threads from parent in thread view
                            onAddReaction={() => {}} // Can still react to parent
                            currentUserId={currentUser.id}
                            isAdmin={false} // Assume not admin for parent display here
                        />
                        <hr style={{borderTop: '1px dashed #ddd', margin: '10px 0'}}/>
                    </>
                )}

                {messages.length === 0 ? (
                    <p style={{textAlign: 'center', color: '#666'}}>No replies yet. Be the first!</p>
                ) : (
                    messages.map(msg => (
                        <MessageItem
                            key={msg.id}
                            message={msg}
                            onReply={() => {}}
                            onStartThread={() => {}}
                            onAddReaction={() => {}}
                            currentUserId={currentUser.id}
                            isAdmin={false} // Assume not admin for replies display here
                        />
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* MessageInput for sending replies in the thread */}
            {/* Pass `chatGroupId` to MessageInput as `groupId` prop */}
            <MessageInput groupId={chatGroupId} onSendMessage={handleSendMessageInThread} replyToMessage={null} clearReply={() => {}} />
        </div>
    );
};

export default ThreadView;