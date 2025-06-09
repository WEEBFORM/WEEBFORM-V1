import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Function to log in the user
export const loginUser = async (username, password) => {
    try {
        const response = await apiClient.post('/login', { username, password });
        return response.data;
    } catch (error) {
        throw error.response ? error.response.data : error.message;
    }
};

// Function to fetch community groups
export const fetchCommunityGroups = async (token) => {
    try {
        const response = await apiClient.get('/community-groups', {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data;
    } catch (error) {
        throw error.response ? error.response.data : error.message;
    }
};