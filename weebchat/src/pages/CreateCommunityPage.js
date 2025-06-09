import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CommunityForm from '../components/Community/CommunityForm';
import { createCommunity } from '../services/CommunityService';

const CreateCommunityPage = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const handleSubmit = async (formData) => {
        setLoading(true);
        setError(null);
        try {
            const newCommunity = await createCommunity(formData);
            setLoading(false);
            // Navigate to the new community page or communities list
            navigate(`/community/${newCommunity.communityId}`); 
        } catch (err) {
            setLoading(false);
            setError(err.message || 'Failed to create community. Ensure image is provided and title is unique.');
            console.error(err);
        }
    };

    return (
        <div className="container">
            <h1 className="page-title">Create a New Community</h1>
            {error && <p className="error-message">{error}</p>}
            <CommunityForm onSubmit={handleSubmit} loading={loading} />
        </div>
    );
};

export default CreateCommunityPage;