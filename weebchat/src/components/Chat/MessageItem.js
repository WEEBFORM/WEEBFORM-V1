import React, { useState } from 'react';
import useAuth from '../../hooks/useAuth';
import { REACTION_TYPES } from '../../constants';
import './MessageItem.css'; // Create this CSS file
import ReactionPicker from './ReactionPicker'; // We'll create this

const MessageItem = ({ message, onReply, onStartThread, onAddReaction }) => {
    const { user: currentUser } = useAuth();
    const [showSpoiler, setShowSpoiler] = useState(false);
    const [showReactionPicker, setShowReactionPicker] = useState(false);

    const isMyMessage = message.senderId === currentUser?.id;
    const defaultPic = 'https://via.placeholder.com/40'; // Placeholder

    const handleReactionSelect = (reactionType, customEmote = null) => {
        onAddReaction(message.id, reactionType, customEmote);
        setShowReactionPicker(false);
    }

    return (
        <div className={`message-item ${isMyMessage ? 'my-message' : 'other-message'}`}>
            <img
                src={message.profilePic || defaultPic} // Use actual profilePic, fallback to default
                alt={message.full_name}
                className="message-avatar"
                onError={(e) => e.target.src = defaultPic} // Fallback if image fails to load
            />
            <div className="message-content">
                <div className="message-sender">
                    {message.full_name}
                    <span className="message-timestamp">{new Date(message.createdAt).toLocaleTimeString()}</span>
                </div>

                {message.replyTo && (
                    <div className="message-reply-context">
                        Replying to <strong>{message.replyTo.full_name}</strong>:
                        <p><em>"{message.replyTo.message?.substring(0,50) || 'Media/Audio Message'}{message.replyTo.message?.length > 50 ? '...' : ''}"</em></p>
                    </div>
                )}

                {message.spoiler && !showSpoiler ? (
                    <div className="message-text spoiler" onClick={() => setShowSpoiler(true)}>
                        Spoiler! Click to reveal.
                    </div>
                ) : (
                    <>
                        {/* Use dangerouslySetInnerHTML for line breaks, or parse and map to <p> tags */}
                        {message.message && <div className="message-text" dangerouslySetInnerHTML={{__html: message.message.replace(/\n/g, '<br />') }}></div>}
                        {message.media && message.media.length > 0 && (
                            <div className="message-media">
                                {message.media.map((url, index) => (
                                    <img key={index} src={url} alt={`media ${index}`} style={{maxWidth: '200px', maxHeight: '200px', margin: '5px'}}/>
                                ))}
                            </div>
                        )}
                        {message.audio && (
                            <div className="message-audio">
                                <audio controls src={message.audio}></audio>
                            </div>
                        )}
                    </>
                )}

                {/* Mentions display: Assuming backend sends array of user IDs from parseMentions */}
                {/* For frontend display, you might want full user names or specific mention objects in `message.mentions` */}
                {message.mentions && message.mentions.length > 0 && (
                    <div className="message-mentions">
                        {/* If backend sends IDs, you'd fetch names. For now, just display IDs */}
                        Mentions: {message.mentions.map(id => `@User_${id}`).join(', ')}
                    </div>
                )}

                {/* Display Reactions */}
                {message.reactions && message.reactions.length > 0 && (
                    <div className="message-reactions-display">
                        {message.reactions.map(r => (
                            <span key={r.id} className="reaction-emoji" title={`${r.userName || 'Unknown User'} reacted with ${r.reactionType || r.customEmote}`}>
                                {/* Display standard emoji or custom emote */}
                                {r.customEmote || (REACTION_TYPES[r.reactionType] || r.reactionType)}
                            </span>
                        ))}
                    </div>
                )}

                <div className="message-actions">
                    <button onClick={() => onReply(message)}>Reply</button>
                    {/* Only show "Start Thread" if no threadId exists on the message */}
                    {!message.threadId && <button onClick={() => onStartThread(message)}>Start Thread</button>}
                    <button onClick={() => setShowReactionPicker(!showReactionPicker)}>React</button>
                    {showReactionPicker && (
                        <ReactionPicker onSelect={handleReactionSelect} />
                    )}
                </div>
                {message.threadId && ( // Show "Part of a thread" if message has a threadId
                    <small>Part of a thread.</small>
                )}
                {/* message.hasRepliesCount is a conceptual prop from backend */}
                {message.hasRepliesCount > 0 && (
                    <small style={{cursor: 'pointer', color: 'blue', marginLeft: '5px'}} onClick={() => onStartThread(message, true)}>
                        {message.hasRepliesCount} replies in thread
                    </small>
                )}
            </div>
        </div>
    );
};

export default MessageItem;