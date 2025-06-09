import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCommunityDetails, joinCommunity, leaveCommunity, deleteCommunity } from '../services/CommunityService';
import useAuth from '../hooks/useAuth';
import LoadingSpinner from '../components/common/LoadingSpinner';
import GroupCard from '../components/Community/GroupCard'; // GroupCard is for chat groups
import placeholderIcon from '../assets/default.png';

const CommunityDetailPage = () => {
    const { communityId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth(); // Current authenticated user

    const [community, setCommunity] = useState(null);
    const [isCommunityMember, setIsCommunityMember] = useState(false); // Tracks current user's membership in THIS community
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false); // For join/leave/delete button states
    const [error, setError] = useState(null);

    const fetchDetails = useCallback(async () => {
        try {
            setLoading(true);
            // `getCommunityDetails` now returns `isCommunityMember` (user's status in the overall community)
            // and `chatGroups` (with `isJoined` status for each chat group).
            const details = await getCommunityDetails(communityId); 
            setCommunity(details);
            setIsCommunityMember(details.isCommunityMember); // Update state based on fetched data
            setError(null);
        } catch (err) {
            console.error("Error fetching community details:", err);
            setError(err.message || 'Failed to load community details.');
            if (err.response && err.response.status === 404) {
                navigate('/404'); // Redirect if community not found
            }
        } finally {
            setLoading(false);
        }
    }, [communityId, navigate]);

    useEffect(() => {
        fetchDetails();
    }, [fetchDetails]);

    const handleJoinCommunity = async () => {
        setActionLoading(true);
        try {
            await joinCommunity(communityId); // Service call to join the overall community
            setIsCommunityMember(true); // Optimistically update state
            // Optimistically update member count
            setCommunity(prev => ({ ...prev, memberCount: (prev.memberCount || 0) + 1 }));
            // Re-fetch details to ensure `chatGroup.isJoined` statuses are updated for default groups
            // (as joining community auto-joins default chat groups)
            fetchDetails(); 
        } catch (err) {
            alert(`Failed to join community: ${err.response?.data?.message || err.message}`);
        }
        setActionLoading(false);
    };

    const handleLeaveCommunity = async () => {
        setActionLoading(true);
        try {
            await leaveCommunity(communityId); // Service call to leave the overall community
            setIsCommunityMember(false); // Optimistically update state
            // Optimistically update member count
            setCommunity(prev => ({ ...prev, memberCount: Math.max(0, (prev.memberCount || 1) - 1) }));
            // Re-fetch details to ensure chatGroup.isJoined statuses are updated (should all be false now)
            fetchDetails(); 
        } catch (err) {
            alert(`Failed to leave community: ${err.response?.data?.message || err.message}`);
        }
        setActionLoading(false);
    };

    const handleDeleteCommunity = async () => {
        if (window.confirm("Are you sure you want to delete this community? This action cannot be undone.")) {
            setActionLoading(true);
            try {
                await deleteCommunity(communityId); // Service call to delete the overall community
                navigate('/communities'); // Redirect after successful deletion
            } catch (err) {
                alert(`Failed to delete community: ${err.response?.data?.message || err.message}`);
            }
            setActionLoading(false);
        }
    };

    if (loading) return <LoadingSpinner />;
    if (error) return <p className="error-message">Error: {error}</p>;
    if (!community) return <p>Community not found.</p>;

    // Check if the current user is the creator of this community
    const isCreator = user && community.creatorId === user.id;

    return (
        <div className="container">
            <div className="card community-detail-header" style={{marginBottom: '20px'}}>
                <img
                    src={community.groupIcon || placeholderIcon}
                    alt={`${community.title} icon`}
                    onError={(e) => e.target.src = placeholderIcon}
                    style={{maxWidth: '150px', float: 'left', marginRight: '20px'}}
                />
                <h1>{community.title}</h1>
                <p>{community.description}</p>
                <p>Members: {community.memberCount}</p>
                <p>Created: {new Date(community.createdAt).toLocaleDateString()}</p>
                <div style={{clear: 'both', paddingTop: '10px'}}>
                    {user && ( // Only show join/leave buttons if user is logged in
                        isCommunityMember ? (
                            <button onClick={handleLeaveCommunity} disabled={actionLoading || isCreator}>
                                {actionLoading ? 'Leaving...' : (isCreator ? 'You are the Creator' : 'Leave Community')}
                            </button>
                        ) : (
                            <button onClick={handleJoinCommunity} disabled={actionLoading}>
                                {actionLoading ? 'Joining...' : 'Join Community'}
                            </button>
                        )
                    )}
                    {isCreator && ( // Only show delete button if current user is the creator
                        <button onClick={handleDeleteCommunity} disabled={actionLoading} style={{ marginLeft: '10px', backgroundColor: '#dc3545' }}>
                            {actionLoading ? 'Deleting...' : 'Delete Community'}
                        </button>
                    )}
                </div>
            </div>

            <h2>Chat Groups in this Community</h2>
            {/* Only display chat groups if the user is a member of the overall community */}
            {isCommunityMember ? (
                community.chatGroups && community.chatGroups.length > 0 ? (
                    <div className="groups-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
                        {community.chatGroups.map(group => (
                            <GroupCard key={group.id} group={group} communityId={community.id} />
                        ))}
                    </div>
                ) : (
                    <p>No chat groups found in this community yet.</p>
                )
            ) : (
                <p>Join this community to view its chat groups.</p>
            )}
        </div>
    );
};

export default CommunityDetailPage;