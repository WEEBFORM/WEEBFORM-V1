import React from 'react';
import SignupForm from '../components/Auth/SignUpForm';
import { Link } from 'react-router-dom';

const SignupPage = () => {
    return (
        <div className="container" style={{ maxWidth: '400px', margin: '50px auto' }}>
            <SignupForm />
            <p style={{ textAlign: 'center', marginTop: '20px' }}>
                Already have an account? <Link to="/login">Login</Link>
            </p>
        </div>
    );
};

export default SignupPage;