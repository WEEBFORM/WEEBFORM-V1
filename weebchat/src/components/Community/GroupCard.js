import React from 'react';
import { Link } from 'react-router-dom';
import placeholderIcon from '../../assets/default.png';

const GroupCard = ({ group, communityId }) => {
    return (
        <div className="card group-card" style={{border: '1px dashed #aaf', padding: '10px'}}>
            <img
                src={group.groupIcon || placeholderIcon}
                alt={`${group.name} icon`}
                onError={(e) => e.target.src = placeholderIcon}
                style={{maxWidth: '50px', maxHeight: '50px'}}
            />
            {/* group.name is used as the title as per the backend schema changes */}
            <h4>{group.name}</h4> 
            <p>Created: {new Date(group.createdAt).toLocaleDateString()}</p>
            {/* Updated Link to include communityId and chatGroupId for the chat page */}
            <Link to={`/community/${communityId}/group/${group.id}`}>
                <button style={{backgroundColor: '#28a745'}}>Open Group Chat</button>
            </Link>
            {/* Optionally display isJoined status, useful for groups the user hasn't joined */}
            {group.isJoined === false && (
                <p style={{fontSize: '0.8em', color: '#666'}}>Click to Join</p>
            )}
        </div>
    );
};

export default GroupCard;