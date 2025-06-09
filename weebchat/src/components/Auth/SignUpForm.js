import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

const SignupForm = () => {
    const [userData, setUserData] = useState({ username: '', email: '', password: '', full_name: '' });
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const { signup } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        setUserData({ ...userData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        setLoading(true);
        // Basic validation
        if (userData.password.length < 6) {
            setError("Password must be at least 6 characters long.");
            setLoading(false);
            return;
        }
        const result = await signup(userData);
        setLoading(false);
        if (result.success) {
            setSuccessMessage(result.message + " Please login.");
            // navigate('/login'); // Or auto-login if your backend supports it
        } else {
            setError(result.message || 'Signup failed. Please try again.');
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <h2>Sign Up</h2>
            {error && <p className="error-message">{error}</p>}
            {successMessage && <p style={{color: "green"}}>{successMessage}</p>}
            <div>
                <label htmlFor="username">Username:</label>
                <input type="text" id="username" name="username" value={userData.username} onChange={handleChange} required />
            </div>
            <div>
                <label htmlFor="full_name">Full Name:</label>
                <input type="text" id="full_name" name="full_name" value={userData.full_name} onChange={handleChange} required />
            </div>
            <div>
                <label htmlFor="email">Email:</label>
                <input type="email" id="email" name="email" value={userData.email} onChange={handleChange} required />
            </div>
            <div>
                <label htmlFor="password">Password:</label>
                <input type="password" id="password" name="password" value={userData.password} onChange={handleChange} required />
            </div>
            <button type="submit" disabled={loading}>
                {loading ? 'Signing up...' : 'Sign Up'}
            </button>
        </form>
    );
};

export default SignupForm;