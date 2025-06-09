import React from 'react';
import CommunityCard from './CommunityCard';
import LoadingSpinner from '../common/LoadingSpinner';

const CommunityList = ({ communities, title, loading, error }) => {
    if (loading) return <LoadingSpinner />;
    if (error) return <p className="error-message">Error: {error.message || JSON.stringify(error)}</p>;
    if (!communities || communities.length === 0) return <p>No communities found in "{title}".</p>;

    return (
        <div>
            <h2>{title}</h2>
            <div className="community-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                {communities.map(community => (
                    <CommunityCard key={community.id} community={community} />
                ))}
            </div>
        </div>
    );
};

export default CommunityList;