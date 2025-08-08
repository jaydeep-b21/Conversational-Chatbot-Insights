import axios from 'axios';

const API_URL = 'http://localhost:8000';

export const sendMessage = (sessionId, message, username, onChunk) => {
  return new Promise((resolve, reject) => {
    const source = new EventSource(
      `${API_URL}/chat?session_id=${encodeURIComponent(sessionId)}&message=${encodeURIComponent(message)}&username=${encodeURIComponent(username)}`
    );

    let fullResponse = '';
    let sourceType = null;
    let sources = [];

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Received chunk:", data);
        
        if (data.response) {
          // Add this chunk to the full response
          fullResponse += data.response;
          
          // Call the chunk callback immediately for real-time streaming
          if (onChunk) {
            onChunk({
              chunk: data.response,
              fullResponse: fullResponse,
              isComplete: false
            });
          }
        } else if (data.is_finished) {
          sourceType = data.source_type || 'llm';
          sources = data.sources || [];
          source.close();
          
          // Final callback with complete response
          if (onChunk) {
            onChunk({
              chunk: '',
              fullResponse: fullResponse,
              isComplete: true,
              source_type: sourceType,
              sources: sources
            });
          }
          
          resolve({ response: fullResponse, source_type: sourceType, sources });
        } else if (data.error) {
          source.close();
          reject(new Error(`Streaming error: ${data.error}`));
        }
      } catch (error) {
        console.error("Error parsing SSE chunk:", error);
        source.close();
        reject(new Error('Error parsing streaming response: ' + error.message));
      }
    };

    source.onerror = (error) => {
      console.error("EventSource error:", error);
      source.close();
      reject(new Error('Error streaming message: ' + (error.message || 'Unknown error')));
    };

    // Return cleanup function
    return () => source.close();
  });
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

// Delete session function
export const deleteSession = async (sessionId, username) => {
  const response = await axios.delete(`${API_URL}/sessions/${sessionId}`, {
    params: { username }
  });
  return response.data;
};

// NEW: Rename session function
export const renameSession = async (sessionId, newName, username) => {
  const response = await axios.put(`${API_URL}/sessions/${sessionId}/rename`, {
    new_name: newName
  }, {
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