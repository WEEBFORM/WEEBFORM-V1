import React, { useState, useEffect } from 'react';
import useAuth from '../../hooks/useAuth';
// No need for axios import here if the data is already pre-fetched/sent via socket
// import axios from 'axios'; 

// The component now expects a prop `onlineUsersData` which is an array of full user objects
const OnlineUsers = ({ onlineUsersData, onUserClick, currentUserId }) => {
    // The state `onlineUsersData` is now directly passed as a prop, 
    // so the internal state `onlineUsersData` and its `useEffect` for fetching are no longer needed.
    // We'll just use the prop directly.

    // A small useEffect can be kept if you need to transform/sort the prop data, 
    // but for simple rendering, it's not strictly necessary.

    // Fallback for profile picture
    const defaultProfilePic = 'https://via.placeholder.com/30';

    return (
        <div className="online-users-list" style={{ padding: '10px', borderLeft: '1px solid #eee', minWidth: '200px', background: '#f8f9fa' }}>
            <h4>Online Users ({onlineUsersData.length})</h4>
            <ul>
                {onlineUsersData.length === 0 ? (
                    <p style={{fontStyle: 'italic', color: '#888'}}>No other users online.</p>
                ) : (
                    onlineUsersData.map(u => (
                        <li key={u.id} // Use u.id directly as it's a user object now
                            onClick={() => onUserClick && onUserClick(u)} // Pass the full user object for admin actions
                            style={{ cursor: onUserClick ? 'pointer' : 'default', listStyle: 'none', padding: '5px 0', display: 'flex', alignItems: 'center' }}
                        >
                            <img 
                                src={u.profilePic || defaultProfilePic} // Use u.profilePic from the provided user object
                                alt={u.full_name || u.username || 'User'} 
                                style={{width: '25px', height: '25px', borderRadius: '50%', marginRight: '8px', objectFit: 'cover'}} 
                                onError={(e) => e.target.src = defaultProfilePic} // Fallback if image fails
                            />
                            {u.full_name || u.username || `User ${u.id}`} {/* Display full_name or username */}
                            {u.id === currentUserId && " (You)"}
                        </li>
                    ))
                )}
            </ul>
        </div>
    );
};

export default OnlineUsers;