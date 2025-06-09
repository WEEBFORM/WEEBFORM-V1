import React, { useEffect, useState } from 'react';
import { getAllCommunities } from '../services/CommunityService';
import CommunityList from '../components/Community/communityList';
import LoadingSpinner from '../components/common/LoadingSpinner';
import './CommunitiesPage.css'; // Ensure CSS path is correct

const CommunitiesPage = () => {
    const [communitiesData, setCommunitiesData] = useState({
        recommended: [],
        popular: [],
        others: [], // 'others' from backend corresponds to 'explore'
        all: []
    });
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'recommended', 'popular', 'explore'
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchSectionData = async (section) => {
            try {
                setLoading(true);
                setError(null);
                // Backend returns data like { section: 'popular', communities: [] }
                // OR { recommended, popular, others, all } if no section query
                const data = await getAllCommunities(section === 'all' ? undefined : section); // 'others' in backend is 'explore' here
                
                if (section === 'all' && data.all) { // Initial load with all sections
                     setCommunitiesData({
                        recommended: data.recommended || [],
                        popular: data.popular || [],
                        others: data.others || [],
                        all: data.all || [],
                     });
                } else if (data.communities) { // Specific section loaded (if backend sends `communities` key)
                     setCommunitiesData(prev => ({ ...prev, [data.section === 'others' ? 'explore' : data.section]: data.communities }));
                } else if (data[section]) { // If section name is the key in the response (e.g., data.recommended)
                     setCommunitiesData(prev => ({ ...prev, [section]: data[section] }));
                }

            } catch (err) {
                console.error(`Error fetching ${section} communities:`, err);
                setError(err);
            } finally {
                setLoading(false);
            }
        };
        
        fetchSectionData(activeTab);

    }, [activeTab]); // Dependency `activeTab` ensures re-fetch when tab changes
    
    const renderCommunities = () => {
        let dataToShow = [];
        let title = "";

        switch(activeTab) {
            case 'recommended':
                dataToShow = communitiesData.recommended;
                title = "Recommended For You";
                break;
            case 'popular':
                dataToShow = communitiesData.popular;
                title = "Popular Communities";
                break;
            case 'explore':
                dataToShow = communitiesData.others; // 'others' from backend
                title = "Explore More Communities";
                break;
            default: // 'all'
                dataToShow = communitiesData.all;
                title = "All Communities";
        }
        return <CommunityList communities={dataToShow} title={title} loading={loading} error={error} />;
    };


    return (
        <div className="container">
            <h1 className="page-title">Discover Communities</h1>
            
            <div className="tabs">
                <button onClick={() => setActiveTab('all')} className={activeTab === 'all' ? 'active' : ''}>All</button>
                <button onClick={() => setActiveTab('recommended')} className={activeTab === 'recommended' ? 'active' : ''}>Recommended</button>
                <button onClick={() => setActiveTab('popular')} className={activeTab === 'popular' ? 'active' : ''}>Popular</button>
                <button onClick={() => setActiveTab('explore')} className={activeTab === 'explore' ? 'active' : ''}>Explore</button>
            </div>

            {loading && <LoadingSpinner />}
            {!loading && error && <p className="error-message">Could not load communities: {error.message}</p>}
            {!loading && !error && renderCommunities()}
        </div>
    );
};

export default CommunitiesPage;