import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { getYourCommunities } from '../services/CommunityService';
import CommunityList from '../components/Community/communityList';
import LoadingSpinner from '../components/common/LoadingSpinner';

const HomePage = () => {
    const { user } = useAuth();
    const [yourCommunities, setYourCommunities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchCommunities = async () => {
            try {
                setLoading(true);
                const data = await getYourCommunities();
                // The backend returns "You haven't joined a community." as a string if empty.
                if (Array.isArray(data)) {
                    setYourCommunities(data);
                } else {
                    setYourCommunities([]); // Or handle the message string
                }
                setError(null);
            } catch (err) {
                setError(err);
                // If 404 and it's a string message, don't treat as error for display
                if (err.status === 404 && typeof err.data === 'string') {
                     setYourCommunities([]);
                     setError(null); // Clear error if it's just "not joined" message
                } else {
                    console.error("Error fetching your communities:", err);
                }
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchCommunities();
        } else {
            setLoading(false); // Not logged in, no communities to fetch
        }
    }, [user]);

    if (loading) return <LoadingSpinner />;

    return (
        <div className="container">
            <h1 className="page-title">Welcome, {user?.full_name || 'Guest'}!</h1>
            {user ? (
                <>
                    <CommunityList 
                        communities={yourCommunities} 
                        title="Your Communities" 
                        loading={loading}
                        error={error}
                    />
                    {yourCommunities.length === 0 && !loading && !error && (
                        <p>You haven't joined any communities yet. <Link to="/communities">Explore communities</Link></p>
                    )}
                    <hr style={{margin: "30px 0"}}/>
                    <p>
                        <Link to="/communities">
                            <button>Explore More Communities</button>
                        </Link>
                    </p>
                </>
            ) : (
                <p>Please <Link to="/login">login</Link> or <Link to="/signup">sign up</Link> to join communities and chat.</p>
            )}
        </div>
    );
};

export default HomePage;