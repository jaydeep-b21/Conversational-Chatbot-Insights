import axios from 'axios';

const API_URL = 'http://localhost:8000';

export const sendMessage = async (sessionId, message, username) => {
  const response = await axios.post(`${API_URL}/chat`, {
    session_id: sessionId,
    message: message,
    username,
  });

  return response.data;
};
  
  export const fetchSessions = async (username) => {
    const response = await axios.get(`${API_URL}/sessions`, {
      params: { username }
    });
    return response.data;
  };
  
export const fetchMessages = async (sessionId, username) => {
  const response = await axios.get(`${API_URL}/chat/${sessionId}`, {
    params: { username }
  });
  return response.data;
};

export const signup = async (username, password) => {
    const response = await axios.post(`${API_URL}/signup`, { username, password });
    return response.data;
  };
  
  export const login = async (username, password) => {
    const response = await axios.post(`${API_URL}/login`, { username, password });
    return response.data;
  };
  