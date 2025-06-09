import React, { useState } from "react";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import LoginForm from "./components/LoginForm";
import CommunityGroups from "./components/CommunityGroups";
import './styles/App.css';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  return (
    <Router>
      <div className="App">
        <Switch>
          <Route path="/" exact>
            {isAuthenticated ? (
              <CommunityGroups />
            ) : (
              <LoginForm onLogin={handleLogin} />
            )}
          </Route>
        </Switch>
      </div>
    </Router>
  );
};

export default App;