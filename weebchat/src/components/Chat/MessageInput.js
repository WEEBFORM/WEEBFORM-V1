import React, { useState, useRef, useEffect } from 'react';
import { uploadMessageMediaApi } from '../../api/messages';
import { fileToBase64 } from '../../utils/fileUploader';

const TYPING_DEBOUNCE_DELAY = 1000; // 1 second

const MessageInput = ({ groupId, onSendMessage, replyToMessage, clearReply, disabled, slowModeActive, onStartTyping, onStopTyping }) => {
    const [message, setMessage] = useState('');
    const [mediaFiles, setMediaFiles] = useState([]);
    const [audioFile, setAudioFile] = useState(null);
    const [isSpoiler, setIsSpoiler] = useState(false);
    const [mentions, setMentions] = useState([]); // Simplified: frontend does not parse names, only stores IDs if manually added
    const [isRecording, setIsRecording] = useState(false);
    const [uploading, setUploading] = useState(false);

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const fileInputRef = useRef(null);
    const audioInputRef = useRef(null);
    const typingTimeoutRef = useRef(null); // Ref for typing debounce timeout

    // --- Typing Debounce Logic ---
    // Emits 'startTyping' on first keypress, 'stopTyping' after delay
    useEffect(() => {
        if (!onStartTyping || !onStopTyping) return; // Ensure handlers are provided

        if (message) {
            // If already typing, clear previous timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            } else {
                // If not currently typing, start typing
                onStartTyping();
            }
            // Set new timeout to stop typing after inactivity
            typingTimeoutRef.current = setTimeout(() => {
                onStopTyping();
                typingTimeoutRef.current = null;
            }, TYPING_DEBOUNCE_DELAY);
        } else {
            // Message input is empty, stop typing immediately if was typing
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
                onStopTyping();
            }
        }

        // Cleanup: Clear timeout on component unmount
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, [message, onStartTyping, onStopTyping]);


    // Clear reply context only when `clearReply` is explicitly called, or after message send
    // This `useEffect` is now removed from here, its job is handled by `handleSubmit`
    // and `GroupChatPage`'s `clearReply` directly.

    const handleInputChange = (e) => {
        setMessage(e.target.value);
    };

    const handleMediaChange = (e) => {
        setMediaFiles(Array.from(e.target.files));
    };

    const handleAudioFileChange = (e) => {
        if (e.target.files[0]) {
            setAudioFile(e.target.files[0]);
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const tempAudioFile = new File([audioBlob], "recorded_audio.webm", { type: 'audio/webm' });
                setAudioFile(tempAudioFile);
                stream.getTracks().forEach(track => track.stop()); // Stop microphone access
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Error starting audio recording:", err);
            alert("Could not start recording. Please ensure microphone access is allowed.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message.trim() && mediaFiles.length === 0 && !audioFile) return;

        setUploading(true);

        let uploadedMediaUrls = [];
        try {
            if (mediaFiles.length > 0) {
                for (const file of mediaFiles) {
                    const url = await uploadMessageMediaApi(file);
                    uploadedMediaUrls.push(url);
                }
            }
        } catch (uploadError) {
            alert(`Error uploading media: ${uploadError.message}`);
            setUploading(false);
            return;
        }

        let audioBase64 = null;
        try {
            if (audioFile) {
                audioBase64 = await fileToBase64(audioFile);
            }
        } catch (base64Error) {
            alert(`Error processing audio file: ${base64Error.message}`);
            setUploading(false);
            return;
        }

        const messageData = {
            groupId, // Passed from GroupChatPage as `chatGroupId`
            message: message.trim() || null, // Ensure message is trimmed
            media: uploadedMediaUrls,
            audio: audioBase64,
            spoiler: isSpoiler,
            mentions: mentions.map(m => m.userId)
        };

        onSendMessage(messageData); // Call the handler from parent

        // Reset form after sending
        setMessage('');
        setMediaFiles([]);
        setAudioFile(null);
        setIsSpoiler(false);
        setMentions([]);
        if (fileInputRef.current) fileInputRef.current.value = null;
        if (audioInputRef.current) audioInputRef.current.value = null;
        // clearReply() is called by the parent through `handleSendMessage` if `replyToMessage` exists.
        // It's not called here in MessageInput's handleSubmit directly, to prevent immediate UI flicker.
        // The parent will clear it in its `handleSendMessage` after the emit.

        // Immediately stop typing indicator, as message is sent
        if (onStopTyping) onStopTyping();

        setUploading(false);
    };

    const addMention = () => {
        const userId = prompt("Enter user ID to mention:");
        const userName = prompt("Enter user name for mention display:");
        if (userId && userName) {
            const mentionText = `@[${userName}](${userId})`;
            setMessage(prev => prev + mentionText + " ");
            setMentions(prev => [...prev, { userId, name: userName }]);
        }
    };

    const isInputDisabled = disabled || uploading;
    const placeholderText = slowModeActive ? "Slow mode active, please wait..." : "Type a message...";

    return (
        <form onSubmit={handleSubmit} className="message-input-form" style={{ padding: '10px', borderTop: '1px solid #ccc', background: '#f9f9f9' }}>
            {replyToMessage && (
                <div className="reply-context-preview" style={{fontSize: '0.9em', background: '#e9e9e9', padding: '5px', borderRadius: '3px', marginBottom: '5px'}}>
                    Replying to: <strong>{replyToMessage.full_name}</strong> <em>"{replyToMessage.message?.substring(0,30)||(replyToMessage.media?.length > 0 ? 'Media' : '')||(replyToMessage.audio ? 'Audio' : '')}{replyToMessage.message?.length > 30 ? '...' : ''}"</em>
                    <button type="button" onClick={clearReply} style={{marginLeft: '10px', background: 'none', border: 'none', color: 'red', cursor: 'pointer'}}>X</button>
                </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <textarea
                    value={message}
                    onChange={handleInputChange}
                    placeholder={placeholderText}
                    rows="2"
                    style={{ flexGrow: 1, marginRight: '10px', resize: 'none' }}
                    disabled={isInputDisabled}
                />
                <button type="submit" disabled={isInputDisabled || (!message.trim() && mediaFiles.length === 0 && !audioFile)}>Send</button>
            </div>
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label htmlFor="media-upload" style={{cursor: 'pointer', padding: '5px', border: '1px solid #ccc', borderRadius: '3px', opacity: isInputDisabled ? 0.6 : 1, pointerEvents: isInputDisabled ? 'none' : 'auto'}}>📎 Attach Media</label>
                <input type="file" id="media-upload" ref={fileInputRef} multiple onChange={handleMediaChange} style={{ display: 'none' }} disabled={isInputDisabled} />

                <label htmlFor="audio-upload" style={{cursor: 'pointer', padding: '5px', border: '1px solid #ccc', borderRadius: '3px', opacity: isInputDisabled ? 0.6 : 1, pointerEvents: isInputDisabled ? 'none' : 'auto'}}>🎤 Upload Audio</label>
                <input type="file" id="audio-upload" ref={audioInputRef} accept="audio/*" onChange={handleAudioFileChange} style={{ display: 'none' }} disabled={isInputDisabled} />

                <button type="button" onClick={isRecording ? stopRecording : startRecording} style={{backgroundColor: isRecording ? '#dc3545' : '#28a745', opacity: isInputDisabled ? 0.6 : 1}} disabled={isInputDisabled}>
                    {isRecording ? '🛑 Stop Rec' : '🎙️ Start Rec'}
                </button>

                <label style={{ opacity: isInputDisabled ? 0.6 : 1 }}>
                    <input type="checkbox" checked={isSpoiler} onChange={(e) => setIsSpoiler(e.target.checked)} disabled={isInputDisabled} />
                    Spoiler
                </label>
                 <button type="button" onClick={addMention} disabled={isInputDisabled}>@ Mention</button>
            </div>
            {mediaFiles.length > 0 && <p style={{fontSize: '0.8em'}}>Selected media: {mediaFiles.map(f => f.name).join(', ')}</p>}
            {audioFile && <p style={{fontSize: '0.8em'}}>Selected audio: {audioFile.name}</p>}
            {uploading && <p style={{fontSize: '0.8em', color: 'blue'}}>Uploading files...</p>}
        </form>
    );
};

export default MessageInput;