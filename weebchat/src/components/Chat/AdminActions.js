import React, { useState } from 'react';
import { ADMIN_ACTIONS } from '../../constants';
import useSocket from '../../hooks/useSocket';

// Frontend AdminActions component
const AdminActions = ({ groupId, targetUser, currentUserId }) => { // groupId is chatGroupId here
    const { emitEvent } = useSocket();
    const [duration, setDuration] = useState(60); // Default 60 seconds for slow, minutes for mute, hours for exile
    const [reason, setReason] = useState('');

    if (!targetUser || targetUser.id === currentUserId) return null; // Don't show for self

    const handleAction = (action) => {
        let actionDuration = duration; // duration is in seconds as per backend applySlowMode/mute
        if (action === ADMIN_ACTIONS.EXILE) actionDuration = duration * 60 * 60; // Exile expects hours, convert to seconds if needed by backend
        else if (action === ADMIN_ACTIONS.MUTE) actionDuration = duration * 60; // Mute expects minutes, convert to seconds

        // Emit to backend, using `chatGroupId` as the property name as expected by `chats.js` socket.on handler
        emitEvent('adminAction', {
            chatGroupId: groupId, // IMPORTANT: Send as `chatGroupId` for backend
            action,
            targetUserId: targetUser.id,
            duration: (action === ADMIN_ACTIONS.REMOVE) ? null : actionDuration, // No duration for remove
            reason
        });
        setReason(''); // Clear reason after action
    };

    return (
        <div className="admin-actions" style={{ border: '1px solid #ffcccb', padding: '10px', marginTop: '10px', background: '#fff0f0' }}>
            <h4>Admin Actions for {targetUser.full_name || targetUser.id}</h4>
            <div>
                <label htmlFor="duration">Duration (seconds for slow, minutes for mute, hours for exile):</label>
                <input
                    type="number"
                    id="duration"
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value, 10))}
                    min="1"
                    style={{width: '80px', margin: '0 5px'}}
                />
            </div>
            <div>
                <label htmlFor="reason">Reason (optional):</label>
                <input
                    type="text"
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    style={{width: 'calc(100% - 100px)', margin: '0 5px'}}
                />
            </div>
            <div style={{marginTop: '10px'}}>
                {Object.values(ADMIN_ACTIONS).map(actionKey => (
                    <button
                        key={actionKey}
                        onClick={() => handleAction(actionKey)}
                        style={{ marginRight: '5px', marginBottom: '5px', backgroundColor: '#e74c3c' }}
                    >
                        {actionKey.replace('_', ' ').toUpperCase()}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default AdminActions;