// src/contexts/AuthContext.js
import React, { createContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../constants';

const AuthContext = createContext();

const getCookie = (name) => {
    const cookieString = document.cookie;
    if (!cookieString) return null;
    const cookies = cookieString.split('; ');
    for (const cookie of cookies) {
        const [cookieName, cookieValue] = cookie.split('=');
        if (cookieName === name) {
            return decodeURIComponent(cookieValue);
        }
    }
    return null;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(getCookie('accessToken') || localStorage.getItem('token'));
    // Add state for userId, initialized from localStorage
    const [userIdForFetch, setUserIdForFetch] = useState(localStorage.getItem('userId'));
    const [loading, setLoading] = useState(true);

    axios.defaults.withCredentials = true;

    const fetchUser = useCallback(async (idToFetch) => {
        // Use the idToFetch passed in, or fallback to userIdForFetch from state (localStorage)
        const currentUserId = idToFetch || userIdForFetch;
        const existingToken = getCookie('accessToken') || localStorage.getItem('token'); // Check for token presence

        if (currentUserId && existingToken) {
            if (!token && existingToken) { // Ensure token state is set if found
                setToken(existingToken);
            }
            try {
                // Use the user ID in the endpoint
                // **IMPORTANT**: Ensure your backend's /api/users/:id endpoint
                // still validates the accessToken cookie for authorization.
                const response = await axios.get(`${API_BASE_URL}/user/${currentUserId}`);

                const userData = response.data; // Assuming response.data IS the user object
                if (userData && userData.id) {
                    setUser(userData);
                    // Ensure userIdForFetch state is also up-to-date if not already
                    if (String(userData.id) !== userIdForFetch) {
                        localStorage.setItem('userId', userData.id);
                        setUserIdForFetch(String(userData.id));
                    }
                } else {
                    throw new Error("User data not found or invalid for the provided ID.");
                }
            } catch (error) {
                console.error(`Failed to fetch user ${currentUserId}:`, error.response ? error.response.data : error.message);
                // If fetching specific user by ID fails, it might not mean the whole session is invalid,
                // unless it's a 401/403 due to token.
                // For now, let's clear if it's likely an auth issue or user not found.
                if (error.response && (error.response.status === 401 || error.response.status === 403 || error.response.status === 404)) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('userId');
                    setToken(null);
                    setUser(null);
                    setUserIdForFetch(null);
                }
            }
        }
        setLoading(false);
    }, [token, userIdForFetch]); // Depend on token and userIdForFetch

    useEffect(() => {
        // On initial load, if userIdForFetch exists (from localStorage), try fetching the user.
        if (userIdForFetch) {
            fetchUser(userIdForFetch);
        } else {
            setLoading(false); // No userId to fetch, so stop loading.
        }
    }, [fetchUser, userIdForFetch]); // Rerun if userIdForFetch changes (e.g. after login sets it)

    const login = async (credentials) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/user/login`, credentials);
            console.log('Login API response.data:', JSON.stringify(response.data, null, 2));

            if (response.data && response.data.user && response.data.user.id) {
                const userObject = response.data.user;
                setUser(userObject); // Set user immediately from login response

                // Store userId in localStorage and set state for subsequent fetchUser calls (e.g., on reload)
                localStorage.setItem('userId', userObject.id);
                setUserIdForFetch(String(userObject.id));

                const accessTokenFromCookie = getCookie('accessToken');
                if (accessTokenFromCookie) {
                    setToken(accessTokenFromCookie);
                    localStorage.setItem('token', accessTokenFromCookie);
                } else {
                    console.warn("accessToken cookie not found after successful login.");
                }
                return { success: true, user: userObject }; // Return user object too
            } else {
                throw new Error(response.data.message || "Login failed: Invalid response structure.");
            }
        } catch (error) {
            console.error("Login error:", error.response ? error.response.data : error.message);
            // ... (error message handling as before)
            let errorMessage = "Login failed. Please try again.";
            if (error.response && error.response.data && error.response.data.message) {
                errorMessage = error.response.data.message;
            } else if (error.message) {
                errorMessage = error.message;
            }
            return { success: false, message: errorMessage };
        }
    };

    const signup = async (userData) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/user/register`, userData);
            console.log('Signup API response.data:', JSON.stringify(response.data, null, 2));

            if (response.data && response.data.user && response.data.user.id && response.data.token) {
                const userObject = response.data.user;
                const receivedToken = response.data.token;

                setUser(userObject); // Set user immediately
                localStorage.setItem('userId', userObject.id); // Store userId
                setUserIdForFetch(String(userObject.id));   // Set userId state

                localStorage.setItem('token', receivedToken);
                setToken(receivedToken);

                return { success: true, message: response.data.message || "Signup successful!", user: userObject };
            } else {
                throw new Error(response.data.message || "Signup failed: Invalid response structure.");
            }
        } catch (error) {
            // ... (error handling as before)
            console.error("Signup error in AuthContext:", error.response ? error.response.data : error.message);
            return { success: false, message: error.response?.data?.message || error.message || "Signup failed" };
        }
    };

    const logout = async () => {
        try {
            await axios.post(`${API_BASE_URL}/user/logout`);
        } catch (error) {
            console.error("Logout API error:", error.response ? error.response.data : error.message);
        } finally {
            localStorage.removeItem('token');
            localStorage.removeItem('userId'); // Clear stored userId
            document.cookie = "accessToken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;";
            setToken(null);
            setUser(null);
            setUserIdForFetch(null); // Clear userId state
        }
    };

    return (
        <AuthContext.Provider value={{ user, token, login, signup, logout, loading, isAuthenticated: !!user, fetchUser, userId: userIdForFetch }}>
            {/* Render children only after initial loading attempt is done */}
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;