import React from 'react';
import LoginForm from '../components/Auth/LoginForm';
import { Link } from 'react-router-dom';

const LoginPage = () => {
    return (
        <div className="container" style={{ maxWidth: '400px', margin: '50px auto' }}>
            <LoginForm />
            <p style={{ textAlign: 'center', marginTop: '20px' }}>
                Don't have an account? <Link to="/signup">Sign Up</Link>
            </p>
        </div>
    );
};

export default LoginPage;