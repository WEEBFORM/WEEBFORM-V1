// services/CommunityService.js

import axios from 'axios';
import { API_BASE_URL } from '../constants'; // Assumes API_BASE_URL is something like 'http://localhost:8000/api/v1'

const getAuthHeaders = () => {
    // Assuming JWT is managed via HttpOnly cookies by backend
    // If you're using localStorage token, uncomment this:
    // const token = localStorage.getItem('token');
    // return token ? { Authorization: `Bearer ${token}` } : {};
    return {}; // If token is in HttpOnly cookie, no need to add Authorization header manually here.
};

axios.defaults.withCredentials = true; // Ensure cookies are sent with all axios requests

// --- COMMUNITY-LEVEL API CALLS ---
// These are prefixed with API_BASE_URL/communities (e.g., POST http://localhost:8000/api/v1/communities/create)

export const createCommunity = async (communityData) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/communities/create`, communityData, {
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'multipart/form-data', // Necessary for file uploads
            },
        });
        return response.data;
    } catch (error) {
        console.error("Error creating community:", error.response?.data || error.message);
        throw error.response?.data || error;
    }
};

export const getYourCommunities = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/communities/existing/joined`, {
            headers: getAuthHeaders(),
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching your communities:", error.response?.data || error.message);
        throw error.response?.data || error;
    }
};

export const getAllCommunities = async (section = 'all') => {
    try {
        const response = await axios.get(`${API_BASE_URL}/communities/`, {
            headers: getAuthHeaders(),
            params: { section } // Query parameter for filtering communities
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching all communities:", error.response?.data || error.message);
        throw error.response?.data || error;
    }
};

export const getCommunityDetails = async (communityId) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/communities/${communityId}`, {
            headers: getAuthHeaders(),
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching community details:", error.response?.data || error.message);
        throw error.response?.data || error;
    }
};

export const joinCommunity = async (communityId) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/communities/join/${communityId}`, {}, {
            headers: getAuthHeaders(),
        });
        return response.data;
    } catch (error) {
        console.error("Error joining community:", error.response?.data || error.message);
        throw error.response?.data || error;
    }
};

export const leaveCommunity = async (communityId) => {
    try {
        // Backend uses DELETE for leave action
        const response = await axios.delete(`${API_BASE_URL}/communities/leave/${communityId}`, { // Corrected URL to /communities/leave/:id as per router.delete('/leave/:id', exitCommunity)
            headers: getAuthHeaders(),
        });
        return response.data;
    } catch (error) {
        console.error("Error leaving community:", error.response?.data || error.message);
        throw error.response?.data || error;
    }
};

export const deleteCommunity = async (communityId) => {
    try {
        const response = await axios.delete(`${API_BASE_URL}/communities/${communityId}`, {
            headers: getAuthHeaders(),
        });
        return response.data;
    } catch (error) {
        console.error("Error deleting community:", error.response?.data || error.message);
        throw error.response?.data || error;
    }
};

// --- CHAT GROUP-LEVEL API CALLS ---
// These are prefixed with API_BASE_URL/communities/groups
// e.g., POST http://localhost:8000/api/v1/communities/groups/community/:communityId/groups

// Create a new chat group within a community (Admin action)
export const createChatGroup = async (communityId, groupData) => {
    // groupData can include title, type, isDefault, groupIcon (FormData if icon)
    try {
        const response = await axios.post(`${API_BASE_URL}/communities/groups/community/${communityId}/groups`, groupData, {
            headers: {
                ...getAuthHeaders(),
                'Content-Type': groupData instanceof FormData ? 'multipart/form-data' : 'application/json',
            },
        });
        return response.data;
    } catch (error) {
        console.error(`Error creating chat group in community ${communityId}:`, error.response?.data || error.message);
        throw error.response?.data || error;
    }
};

// Edit an existing chat group (Admin action)
export const editChatGroup = async (chatGroupId, groupData) => {
    // groupData can include title, type, isDefault, groupIcon (FormData if icon), clearGroupIcon
    try {
        const response = await axios.put(`${API_BASE_URL}/communities/groups/${chatGroupId}`, groupData, {
            headers: {
                ...getAuthHeaders(),
                'Content-Type': groupData instanceof FormData ? 'multipart/form-data' : 'application/json',
            },
        });
        return response.data;
    } catch (error) {
        console.error(`Error editing chat group ${chatGroupId}:`, error.response?.data || error.message);
        throw error.response?.data || error;
    }
};

// Delete a chat group (Admin action)
export const deleteChatGroup = async (chatGroupId) => {
    try {
        const response = await axios.delete(`${API_BASE_URL}/communities/groups/${chatGroupId}`, {
            headers: getAuthHeaders(),
        });
        return response.data;
    } catch (error) {
        console.error(`Error deleting chat group ${chatGroupId}:`, error.response?.data || error.message);
        throw error.response?.data || error;
    }
};

// Get details of a specific chat group
export const getChatGroupDetails = async (chatGroupId) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/communities/groups/${chatGroupId}`, {
            headers: getAuthHeaders(),
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching chat group details ${chatGroupId}:`, error.response?.data || error.message);
        throw error.response?.data || error;
    }
};


// Get all chat groups for a specific community (and current user's join status)
export const getChatGroupsForCommunity = async (communityId) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/communities/groups/community/${communityId}/all`, {
            headers: getAuthHeaders(),
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching chat groups for community ${communityId}:`, error.response?.data || error.message);
        throw error.response?.data || error;
    }
};

// Get only the chat groups the current user is a member of in a specific community
export const getMyChatGroupsInCommunity = async (communityId) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/communities/groups/community/${communityId}/my-groups`, {
            headers: getAuthHeaders(),
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching user's chat groups in community ${communityId}:`, error.response?.data || error.message);
        throw error.response?.data || error;
    }
};

// User joins a specific chat group
export const joinSpecificChatGroup = async (chatGroupId) => {
    try {
        // FIX: CRITICAL URL CORRECTION - matches backend router.post('/join/:chatGroupId') within /communities/groups router
        const response = await axios.post(`${API_BASE_URL}/communities/groups/join/${chatGroupId}`, {}, {
            headers: getAuthHeaders(),
        });
        return response.data;
    } catch (error) {
        console.error(`Error joining chat group ${chatGroupId}:`, error.response?.data || error.message);
        throw error.response?.data || error;
    }
};

// User leaves a specific chat group
export const leaveSpecificChatGroup = async (chatGroupId) => {
    try {
        // FIX: CRITICAL URL CORRECTION - matches backend router.delete('/:chatGroupId/leave') within /communities/groups router
        const response = await axios.delete(`${API_BASE_URL}/communities/groups/${chatGroupId}/leave`, {
            headers: getAuthHeaders(),
        });
        return response.data;
    } catch (error) {
        console.error(`Error leaving chat group ${chatGroupId}:`, error.response?.data || error.message);
        throw error.response?.data || error;
    }
};