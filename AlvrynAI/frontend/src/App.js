import React, { useState, useEffect } from "react";
import "./App.css";

const API = "http://localhost:4000/api";

function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [feed, setFeed] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/content/feed`)
      .then((res) => res.json())
      .then((data) => setFeed(data.items || []));
  }, []);

  const signup = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch(`${API}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (data.accessToken) setUser(data.user);
      else setError(data.error || "Signup failed");
    } catch (err) {
      setError("Signup error");
    }
  };

  const login = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.accessToken) setUser(data.user);
      else setError(data.error || "Login failed");
    } catch (err) {
      setError("Login error");
    }
  };

  return (
    <div className="app-container">
      <nav className="navbar">
        <span className="logo">Alvryn AI</span>
        <span className="business-tagline">Empowering Creators & Businesses</span>
        {user && (
          <span className="user-info">Logged in as <b>{user.name || user.email}</b></span>
        )}
      </nav>
      {!user ? (
        <div>
          <div className="form-section">
            <h2>Sign Up</h2>
            <form onSubmit={signup}>
              <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
              <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
              <button type="submit">Sign Up</button>
            </form>
          </div>
          <div className="form-section">
            <h2>Login</h2>
            <form onSubmit={login}>
              <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
              <button type="submit">Login</button>
            </form>
            {error && <div className="error">{error}</div>}
          </div>
        </div>
      ) : (
        <div className="dashboard">
          <div className="welcome-card">
            <h2>Welcome, {user.name || user.email}</h2>
            <p>Access your personalized content feed and engage with trending posts.</p>
          </div>
          <h3>Content Feed</h3>
          <ul className="feed-list">
            {feed.map((item) => (
              <li className="feed-item" key={item._id}>
                <div className="feed-title">{item.title}</div>
                <div className="feed-platform">Platform: {item.platform}</div>
                <a className="feed-link" href={item.url} target="_blank" rel="noopener noreferrer">View Content</a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
