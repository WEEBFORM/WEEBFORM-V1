import React, { useEffect, useState } from 'react';
import { fetchCommunityData } from '../services/api';

const CommunityGroups = () => {
    const [communityGroups, setCommunityGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const getCommunityGroups = async () => {
            try {
                const data = await fetchCommunityData();
                setCommunityGroups(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        getCommunityGroups();
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    return (
        <div>
            <h1>Community Groups</h1>
            <ul>
                {communityGroups.map((group) => (
                    <li key={group.id}>{group.name}</li>
                ))}
            </ul>
        </div>
    );
};

export default CommunityGroups;