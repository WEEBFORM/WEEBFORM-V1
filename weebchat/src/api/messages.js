// weebform-frontend/src/api/messages.js

import axios from 'axios';

// Get the base API URL from environment variables
// This should be defined in your .env file like: REACT_APP_API_URL=http://localhost:8001/api/v1
const API_URL = 'http://localhost:8000/api/v1'; // Replace with process.env.REACT_APP_API_URL if using .env

// Create an Axios instance with base URL and credentials for cookies
const axiosInstance = axios.create({
    baseURL: API_URL,
    withCredentials: true, // IMPORTANT: Allows cookies (including accessToken) to be sent with requests
});

/**
 * Fetches all messages for a specific chat group.
 * Corresponds to backend: GET /api/v1/communities/groups/messages/:chatGroupId
 * @param {string} chatGroupId The ID of the chat group.
 * @returns {Promise<Array>} A promise that resolves to an array of message objects.
 */
export const fetchGroupMessagesApi = async (chatGroupId) => {
    try {
        const response = await axiosInstance.get(`/communities/groups/messages/${chatGroupId}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching messages for chat group ${chatGroupId}:`, error.response?.data || error.message);
        throw error; // Re-throw for handling in the calling component
    }
};

/**
 * Uploads a single media file for a message.
 * Corresponds to backend: POST /api/v1/communities/groups/messages/upload
 * @param {File} file The File object to upload.
 * @returns {Promise<string>} A promise that resolves to the S3 URL of the uploaded media.
 */
export const uploadMessageMediaApi = async (file) => {
    try {
        const formData = new FormData();
        formData.append('media', file); // 'media' should match the field name in your backend's Multer setup (messages.js)

        const response = await axiosInstance.post('/communities/groups/messages/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }, // Important for file uploads
        });
        return response.data.mediaUrl; // Assuming your backend returns { mediaUrl: "..." }
    } catch (error) {
        console.error("Error uploading message media:", error.response?.data || error.message);
        throw error; // Re-throw for handling in the calling component
    }
};

/**
 * Edits an existing message's text content.
 * Corresponds to backend: PUT /api/v1/communities/groups/messages/:messageId
 * @param {string} messageId The ID of the message to edit.
 * @param {string} newText The new text content for the message.
 * @returns {Promise<object>} A promise that resolves to the backend response.
 */
export const editMessageApi = async (messageId, newText) => {
    try {
        const response = await axiosInstance.put(`/communities/groups/messages/${messageId}`, { message: newText });
        return response.data;
    } catch (error) {
        console.error(`Error editing message ${messageId}:`, error.response?.data || error.message);
        throw error;
    }
};

/**
 * Deletes a message.
 * Corresponds to backend: DELETE /api/v1/communities/groups/messages/:messageId
 * @param {string} messageId The ID of the message to delete.
 * @returns {Promise<object>} A promise that resolves to the backend response.
 */
export const deleteMessageApi = async (messageId) => {
    try {
        const response = await axiosInstance.delete(`/communities/groups/messages/${messageId}`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting message ${messageId}:`, error.response?.data || error.message);
        throw error;
    }
};