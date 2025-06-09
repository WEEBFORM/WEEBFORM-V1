import axios from 'axios';
import { API_BASE_URL } from '../constants';

// Example: Fetch current user (if not done in AuthContext or for refreshing)
export const getCurrentUser = async () => {
    try {
        const token = localStorage.getItem('token');
        // Assuming your backend returns user info directly or within a 'user' property
        const response = await axios.get(`${API_BASE_URL}/users/me`, { // Adjust endpoint
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data; 
    } catch (error) {
        console.error("Error fetching current user:", error);
        throw error;
    }
};

// Login and Signup are now primarily handled within AuthContext for simplicity
// but could be refactored here if preferred.