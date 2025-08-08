# Conversational Chatbot with Web Search Capability

This project is a **Conversational Chatbot** built with **FastAPI**, integrated with **Cohere's language model** for natural language processing and **SerpAPI** for real-time web search capabilities. It supports session-based chat history, user authentication, and intelligent query resolution. The backend stores chat data in **MongoDB** and includes CORS middleware for seamless frontend integration.

## Features

- **Conversational AI**: Powered by Cohere's `command-r-plus` model for natural, context-aware responses.
- **Web Search Integration**: Uses SerpAPI to fetch real-time web results for queries requiring recent information (e.g., news, updates, latest events).
- **Session Management**: Stores chat history in MongoDB, allowing users to retrieve past conversations.
- **User Authentication**: Supports signup and login with password hashing using `passlib`.
- **Intelligent Query Handling**:
  - Detects greetings and responds warmly.
  - Identifies queries needing web searches based on keywords (e.g., "latest," "news") or recent years.
  - Rewrites vague queries using the LLM for precise web searches.
- **CORS Support**: Configured for frontend integration (e.g., a React app running on `http://localhost:3000`).

---

##  Demo

![Demo](Conversational%20Chatbot%20Insights/demo/intellivus_chat_gif1.gif)

> _A walkthrough of how the Conversational AI Intellivus, showcases real-time responses, web search, user login and chat history features_

---

## Prerequisites

- **Python 3.11+**
- **MongoDB**: Running locally on `mongodb://localhost:27017`.
- **API Keys**:
  - **Cohere API Key**: For language model access.
  - **SerpAPI Key**: For web search functionality.
- A frontend application (optional, configured for `http://localhost:3000`).

## Installation

1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd <repository-folder>
   ```

2. **Set Up a Virtual Environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install Dependencies**:
   ```bash
   pip install fastapi uvicorn pymongo requests passlib[bcrypt] python-dotenv
   ```

4. **Configure Environment Variables**:
   Create a `.env` file in the project root and add your API keys:
   ```env
   COHERE_API_KEY=your_cohere_api_key
   SERP_API_KEY=your_serpapi_key
   ```
   Update the `COHERE_API_KEY` and `SERP_API_KEY` variables in the code with these values if not using `.env`.

5. **Set Up MongoDB**:
   Ensure MongoDB is running locally:
   ```bash
   mongod
   ```
   The app connects to `mongodb://localhost:27017` and uses a database named `chatdb`.

6. **Run the Application**:
   ```bash
   uvicorn main:app --reload
   ```
   The API will be available at `http://localhost:8000`.

## API Endpoints

### Chat Endpoint
- **POST `/chat`**:
  - **Request Body**:
    ```json
    {
      "session_id": "unique_session_id",
      "message": "User's message",
      "username": "authenticated_username"
    }
    ```
  - **Response**:
    ```json
    {
      "response": "Chatbot's response",
      "source_type": "llm | web",
      "sources": ["url1", "url2", ...]
    }
    ```
  - Handles user messages, responds with LLM or web search results, and saves chat history.

### Session Management
- **GET `/sessions?username={username}`**:
  - Returns a list of session previews for the authenticated user:
    ```json
    [
      {
        "session_id": "session_id",
        "preview": "First message of the session"
      },
      ...
    ]
    ```
- **GET `/chat/{session_id}?username={username}`**:
  - Retrieves the full chat history for a given session:
    ```json
    [
      {
        "role": "User | Chatbot",
        "message": "Message content",
        "created_at": "ISO timestamp",
        "source_type": "llm | web",
        "sources": ["url1", "url2", ...]
      },
      ...
    ]
    ```

### Authentication
- **POST `/signup`**:
  - **Request Body**:
    ```json
    {
      "username": "new_user",
      "password": "password123"
    }
    ```
  - Creates a new user with a hashed password.
  - Returns `{ "message": "Signup successful" }` or a 400 error if the username exists.

- **POST `/login`**:
  - **Request Body**:
    ```json
    {
      "username": "existing_user",
      "password": "password123"
    }
    ```
  - Validates credentials and returns `{ "message": "Login successful" }` or a 401 error if invalid.

## How It Works

1. **Greeting Detection**:
   - Messages like "hi," "hello," or "how are you?" trigger a friendly LLM-generated response without web search.
2. **Web Search Trigger**:
   - Queries containing keywords like "latest," "news," trigger a SerpAPI web search.
   - The LLM rewrites vague queries into precise search terms.
   - Web results are summarized and included in the LLM's response.
3. **Normal LLM Response**:
   - For queries not requiring web search, the Cohere LLM generates a response based on the chat history.
4. **Session Persistence**:
   - All messages are stored in MongoDB with session IDs, usernames, timestamps, and source metadata.
5. **Security**:
   - Passwords are hashed using `bcrypt`.
   - CORS is configured for secure frontend-backend communication.

## Example Usage

1. **Sign Up**:
   ```bash
   curl -X POST "http://localhost:8000/signup" -H "Content-Type: application/json" -d '{"username": "testuser", "password": "testpass"}'
   ```

2. **Log In**:
   ```bash
   curl -X POST "http://localhost:8000/login" -H "Content-Type: application/json" -d '{"username": "testuser", "password": "testpass"}'
   ```

3. **Send a Chat Message**:
   ```bash
   curl -X POST "http://localhost:8000/chat" -H "Content-Type: application/json" -d '{"session_id": "session1", "message": "What's the latest news?", "username": "testuser"}'
   ```

4. **Retrieve Sessions**:
   ```bash
   curl "http://localhost:8000/sessions?username=testuser"
   ```

5. **Retrieve Session Messages**:
   ```bash
   curl "http://localhost:8000/chat/session1?username=testuser"
   ```

## Project Structure

```plaintext
├── mongo_apis.py           # FastAPI application code
├── requirements.txt  # Python dependencies
├── .env             # Environment variables (not tracked in git)
├── README.md        # This file
```

## Dependencies

- `fastapi`: Web framework for building the API.
- `uvicorn`: ASGI server for running the FastAPI app.
- `pymongo`: MongoDB driver for Python.
- `requests`: For making HTTP requests to Cohere and SerpAPI.
- `passlib[bcrypt]`: For secure password hashing.
- `python-dotenv`: For loading environment variables (optional).

## Notes

- **API Keys**: Store API keys securely in `.env` or update the code directly. Do not expose them in version control.
- **MongoDB**: Ensure MongoDB is running locally or update the connection string for a remote instance.
- **CORS**: Adjust `allow_origins` in the CORS middleware to match your frontend's URL.
- **Scalability**: For production, consider adding rate limiting, input validation, and error handling.
- **Frontend**: The app is configured to work with a frontend at `http://localhost:3000`. Update the CORS settings for other origins.

## Future Improvements

- Add rate limiting for API requests.
- Implement token-based authentication (e.g., JWT).
---
