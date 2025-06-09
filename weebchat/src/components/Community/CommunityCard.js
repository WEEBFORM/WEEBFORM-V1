import React from 'react';
import { Link } from 'react-router-dom';
import placeholderIcon from '../../assets/default.png'; // Add a placeholder image

const CommunityCard = ({ community }) => {
    return (
        <div className="card community-card">
            <img 
                src={community.groupIcon || placeholderIcon} 
                alt={`${community.title} icon`} 
                onError={(e) => e.target.src = placeholderIcon} // Fallback if URL is broken
            />
            <h3>{community.title}</h3>
            <p>{community.description?.substring(0, 100)}{community.description?.length > 100 ? '...' : ''}</p>
            <p>Members: {community.memberCount || 0}</p>
            <Link to={`/community/${community.id}`}>
                <button>View Community</button>
            </Link>
        </div>
    );
};

export default CommunityCard;