import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/socketContext';

import Navbar from './components/common/NavBar';
import ProtectedRoute from './components/common/ProtectedRoute';

import HomePage from './pages/Homepage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import CommunitiesPage from './pages/CommunitiesPage';
import CreateCommunityPage from './pages/CreateCommunityPage';
import CommunityDetailPage from './pages/CommunityDetailPage';
import GroupChatPage from './pages/GroupChatPage';
import NotFoundPage from './pages/NotFoundPage'; // Create this simple page

const App = () => {
    return (
        <AuthProvider>
            {/* SocketProvider is inside AuthProvider to access auth token */}
            <SocketProvider> 
                <Router>
                    <Navbar />
                    <main> {/* Optional: wrap Routes in a main tag for semantics */}
                        <Routes>
                            {/* Public Routes */}
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/signup" element={<SignupPage />} />
                            
                            {/* Protected Routes */}
                            <Route element={<ProtectedRoute />}>
                                <Route path="/" element={<HomePage />} />
                                <Route path="/communities" element={<CommunitiesPage />} />
                                <Route path="/communities/create" element={<CreateCommunityPage />} />
                                <Route path="/community/:communityId" element={<CommunityDetailPage />} />
                                <Route path="/community/:communityId/group/:groupId" element={<GroupChatPage />} />
                            </Route>

                            {/* Fallback Routes */}
                            <Route path="/404" element={<NotFoundPage />} />
                            <Route path="*" element={<Navigate to="/404" replace />} />
                        </Routes>
                    </main>
                </Router>
            </SocketProvider>
        </AuthProvider>
    );
};

export default App;