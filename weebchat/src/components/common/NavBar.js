import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

const Navbar = () => {
    const { isAuthenticated, user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <nav className="navbar">
            <Link to="/">Weebform</Link>
            <div>
                {isAuthenticated ? (
                    <>
                        <Link to="/communities">Communities</Link>
                        <Link to="/communities/create">Create Community</Link>
                        <span>Welcome, {user?.full_name || user?.username || 'User'}!</span>
                        <button onClick={handleLogout} style={{ marginLeft: '10px' }}>Logout</button>
                    </>
                ) : (
                    <div className="auth-links">
                        <Link to="/login">Login</Link>
                        <Link to="/signup">Sign Up</Link>
                    </div>
                )}
            </div>
        </nav>
    );
};

export default Navbar;