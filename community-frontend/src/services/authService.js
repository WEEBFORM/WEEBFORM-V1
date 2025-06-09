import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api/auth'; // Replace with your backend URL

export const login = async (email, password) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/login`, { email, password });
        const { token } = response.data;
        localStorage.setItem('authToken', token); // Save token to localStorage
        return token;
    } catch (error) {
        console.error('Login failed:', error);
        throw error;
    }
};

export const logout = () => {
    localStorage.removeItem('authToken'); // Remove token from localStorage
};

export const getAuthToken = () => {
    return localStorage.getItem('authToken');
};