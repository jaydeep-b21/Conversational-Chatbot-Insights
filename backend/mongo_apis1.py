from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, AsyncGenerator
import requests
import json
import re
from passlib.context import CryptContext
from pymongo import MongoClient
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware

# === API KEYS & URLs ===
COHERE_API_KEY = "sNvH7BXlEGHdhomPtEalgqEGRJZiQxnMEEV2pEsX"
COHERE_API_URL = "https://api.cohere.ai/v1/chat"
SERP_API_KEY = "68ad7d52c518c9e05af9698a722827845c34a11c0771ab5e97099427c64f609a"
SERP_API_URL = "https://serpapi.com/search"

HEADERS = {
    "Authorization": f"Bearer {COHERE_API_KEY}",
    "Content-Type": "application/json"
}

# === MongoDB Configuration ===
client = MongoClient("mongodb://localhost:27017")
db = client["chatdb"]
collection = db["chat_history"]
user_collection = db["users"]

# === FastAPI App ===
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Models ===
class ChatRequest(BaseModel):
    session_id: str
    message: str
    username: str

class UserCredentials(BaseModel):
    username: str
    password: str

# === Helper Functions ===
def get_chat_history(session_id: str, username: str) -> List[dict]:
    history_cursor = collection.find(
        {"session_id": session_id, "username": username},
        {"_id": 0, "role": 1, "message": 1}
    ).sort("created_at", 1)

    role_map = {"user": "USER", "assistant": "CHATBOT"}
    return [
        {
            "role": role_map.get(doc["role"].lower(), doc["role"].upper()),
            "message": doc["message"]
        }
        for doc in history_cursor
    ]


def save_message(session_id: str, role: str, message: str, username: str, source_type=None, sources=None):
    collection.insert_one({
        "session_id": session_id,
        "role": role,
        "message": message,
        "username": username,
        "source_type": source_type,
        "sources": sources or [],
        "created_at": datetime.utcnow()
    })

# === Web Search Integration ===
def serp_search(query: str) -> Dict:
    params = {
        "q": query,
        "api_key": SERP_API_KEY,
        "engine": "google",
        "num": 3
    }
    response = requests.get(SERP_API_URL, params=params, timeout=10)
    response.raise_for_status()
    data = response.json()

    results = data.get("organic_results", [])
    if not results:
        return {"summary": "No relevant search results found.", "sources": []}

    snippets = []
    links = []
    for item in results:
        title = item.get("title", "")
        snippet = item.get("snippet", "")
        link = item.get("link", "")
        links.append(link)
        snippets.append(f"{title}: {snippet}\n{link}")

    return {
        "summary": "\n\n".join(snippets),
        "sources": links
    }

# === Web Search Trigger Logic ===
def needs_web_search(query: str, cutoff_year: int = 2022) -> bool:
    query_lower = query.lower()
    recent_keywords = [
        "today", "yesterday", "breaking", "currently", "latest", "last week", "last month",
        "this week", "this month", "just happened", "right now", "live",
        "update", "recent", "ongoing", "news", "recently"
    ]
    if any(keyword in query_lower for keyword in recent_keywords):
        return True
    years = re.findall(r"\b(20\d{2})\b", query_lower)
    if any(int(year) > cutoff_year for year in years):
        return True
    return False

# === LLM Call with Streaming ===
# Replace your ask_cohere function with this fixed version

async def ask_cohere(prompt: str, chat_history: List[dict] = None, stream: bool = False) -> AsyncGenerator[str, None]:
    payload = {
        "message": prompt,
        "model": "command-r-plus",
        "temperature": 0.5,
        "max_tokens": 1000,
        "stream": stream
    }
    if chat_history:
        payload["chat_history"] = chat_history

    if not stream:
        response = requests.post(COHERE_API_URL, json=payload, headers=HEADERS)
        if response.status_code == 200:
            yield response.json().get("text", "[No response]")
        else:
            print("Cohere Error:", response.status_code, response.text)
            yield "[LLM error]"
        return

    response = requests.post(COHERE_API_URL, json=payload, headers=HEADERS, stream=True)
    if response.status_code != 200:
        print("Cohere Error:", response.status_code, response.text)
        yield json.dumps({"error": "[LLM streaming error]"})
        return

    print("DEBUG: Starting to process Cohere streaming response")
    
    # Process streaming response from Cohere
    for line in response.iter_lines(decode_unicode=True):
        if line:
            line = line.strip()
            print(f"DEBUG: Raw line from Cohere: {line}")
            
            try:
                data = json.loads(line)
                
                # Handle different event types from Cohere streaming API
                if data.get("event_type") == "text-generation":
                    # This is the actual text content
                    text = data.get("text", "")
                    if text:
                        yield json.dumps({"response": text})
                        
                elif data.get("event_type") == "stream-end":
                    # Stream has ended
                    yield json.dumps({"is_finished": True})
                    return
                    
                elif data.get("event_type") == "stream-start":
                    # Stream is starting - ignore this event
                    continue
                    
                # Handle legacy format if needed
                elif "text" in data and data.get("text"):
                    yield json.dumps({"response": data.get("text", "")})
                    
                elif data.get("is_finished"):
                    yield json.dumps({"is_finished": True})
                    return
                    
            except json.JSONDecodeError as e:
                print(f"DEBUG: Failed to parse JSON: {line}, Error: {e}")
                # Skip malformed lines
                continue
                
    # Ensure we always send a finish signal
    yield json.dumps({"is_finished": True})

def is_greeting(message: str) -> bool:
    greetings = [r"\bhi\b", r"\bhello\b", r"\bhey\b", r"good (morning|afternoon|evening|night)", r"how are you\??", r"what'?s up\??", r"how'?s it going\??"]
    return any(re.search(greet, message.lower()) for greet in greetings)

async def rewrite_query_with_llm(message: str, chat_history: List[dict]) -> str:
    prompt = (
        "You are an AI assistant helping a user search the web.\n\n"
        "Given the conversation so far and the user's latest message, rewrite the latest message into a complete, standalone, and precise web search query. "
        "Preserve the user's intent, avoid generalizations, and resolve vague references like 'and', 'what about', or 'who'.\n\n"
        f"Chat history:\n{format_chat_history(chat_history)}\n\n"
        f"Latest message: \"{message}\"\n\n"
        "Rewritten standalone query:"
    )
    async for response in ask_cohere(prompt, stream=False):
        return response.strip()

# === Format chat history ===
def format_chat_history(chat_history):
    return "\n".join([
        f"{msg['role'].capitalize()}: {msg['message']}" for msg in chat_history
    ])

# === Main Chat Endpoint with Streaming ===
# Replace your chat endpoint function with this improved version

async def chat(request: ChatRequest):
    message = request.message.strip()
    chat_history = get_chat_history(request.session_id, request.username)

    # Save user message to DB
    save_message(request.session_id, "user", message, request.username)

    async def stream_response() -> AsyncGenerator[str, None]:
        nonlocal chat_history
        full_response = ""
        source_type = "llm"
        sources = []

        try:
            # 🟢 Greeting flow
            if is_greeting(message):
                greeting_prompt = (
                    f"The user greeted you with: \"{message}\"\n\n"
                    "Respond warmly and naturally as a helpful assistant. But do not mention your name, that you are an AI assistant, or describe what you are. "
                    "Include a friendly tone, maybe an emoji if appropriate, and invite them to ask their question."
                )
                print(f"\n🟢 Greeting flow: {greeting_prompt}\n")
                
                async for chunk in ask_cohere(greeting_prompt, chat_history=chat_history, stream=True):
                    try:
                        chunk_data = json.loads(chunk)
                        if "response" in chunk_data and chunk_data["response"]:
                            full_response += chunk_data["response"]
                            sse_chunk = f"data: {chunk}\n\n"
                            print(f"DEBUG: Sending SSE chunk: {sse_chunk.strip()}")
                            yield sse_chunk
                        elif chunk_data.get("is_finished"):
                            sse_chunk = f"data: {json.dumps({'is_finished': True, 'source_type': source_type, 'sources': sources})}\n\n"
                            print(f"DEBUG: Sending final SSE chunk: {sse_chunk.strip()}")
                            yield sse_chunk
                            break
                    except json.JSONDecodeError as e:
                        print(f"DEBUG: JSON parsing error in greeting flow: {e}")
                        continue
                        
                # Save to database
                save_message(request.session_id, "assistant", full_response, request.username, source_type=source_type, sources=sources)
                return

            # 🟡 Web search flow
            elif needs_web_search(message):
                resolved_query = await rewrite_query_with_llm(message, chat_history)
                print(f"\nRewritten query for web search: {resolved_query}\n")
                web_data = serp_search(resolved_query)
                formatted_history = format_chat_history(chat_history)

                combined_prompt = (
                    "# Role\n"
                    "You are a well-informed and helpful assistant continuing an ongoing conversation with a user.\n\n"
                    "# Context\n"
                    "Here is helpful information from a recent web search:\n"
                    f"{web_data['summary']}\n\n"
                    "# Chat History\n"
                    f"{formatted_history}\n\n"
                    "# User Query\n"
                    f"The user now asks:\n\"{message}\"\n\n"
                    "# Guidelines\n"
                    "- Respond accurately and thoroughly using the provided context and prior messages.\n"
                    "- Tailor your depth to the nature of the question (short if simple, detailed if complex).\n"
                    "- If the topic is broad, organize your response into clear, relevant sections (e.g., `Politics`, `Military`, `Economy`, `Society`, etc.).\n"
                    "# Important\n"
                    "- If the question is ambiguous, briefly address multiple interpretations.\n"
                    "- Only include a **`Summary`** section at the end **if it adds value** beyond the main content.\n"
                    "- Always end with a warm, supportive closing that invites follow-up questions.\n"
                    "# Style Tips\n"
                    "- Use a natural, conversational tone—avoid sounding robotic or overly formal.\n"
                    "- Use **emojis in bullet points** when they help make information more clear and visually accessible.\n"
                    "- Keep your language clear and reader-friendly.\n"
                )

                print(f"\n🟡 Web search flow: {combined_prompt}\n")
                source_type = "web"
                sources = web_data.get("sources", [])
                
                async for chunk in ask_cohere(combined_prompt, chat_history=chat_history, stream=True):
                    try:
                        chunk_data = json.loads(chunk)
                        if "response" in chunk_data and chunk_data["response"]:
                            full_response += chunk_data["response"]
                            sse_chunk = f"data: {chunk}\n\n"
                            print(f"DEBUG: Sending SSE chunk: {sse_chunk.strip()}")
                            yield sse_chunk
                        elif chunk_data.get("is_finished"):
                            sse_chunk = f"data: {json.dumps({'is_finished': True, 'source_type': source_type, 'sources': sources})}\n\n"
                            print(f"DEBUG: Sending final SSE chunk: {sse_chunk.strip()}")
                            yield sse_chunk
                            break
                    except json.JSONDecodeError as e:
                        print(f"DEBUG: JSON parsing error in web search flow: {e}")
                        continue
                        
            else:
                # 🔵 Normal LLM response flow
                base_prompt = (
                    f"You are a well-informed and helpful assistant. A user has asked the following:\n"
                    f"\"{message}\"\n\n"
                    '''
                    # Guidelines
                    1. Respond with thoroughness, clarity, and helpfulness, adapting to the complexity of the user's query. Respond directly without thanks or commentary about the prompt itself.
                    2. For broad or complex topics, organize the response into clearly labeled sections (e.g., Politics, Military, Economy, Diplomacy, Society, etc.).
                    3. Maintain a natural, conversational tone throughout.
                    4. Use current, credible sources if web search results are available.
                    
                    # Important
                    1. Match the depth and format of your response to the query type:
                       a. For simple or factual questions: provide a brief, direct answer.
                       b. For complex or open-ended questions: offer a structured, detailed explanation.
                    2. If the question is ambiguous, briefly cover multiple possible interpretations.
                    3. Include a Summary section only if it adds value (i.e., when it improves clarity or reinforces key points).
                    4. Conclude with a warm, encouraging closing, inviting follow-up or deeper questions.
                    
                    # Style Tips
                    1. Use bullet points with emojis when helpful for clarity and visual structure.
                    2. Focus on clarity over verbosity—avoid over-explaining unless context demands it.
                    3. Avoid robotic or overly formal tone—keep it friendly, human-like, and informed.
                    4. Maintain flexibility—don't force summaries or sections if they don't serve the user's intent.
                    '''
                )
                print(f"\n🔵 Normal LLM response flow: {base_prompt}\n")
                
                async for chunk in ask_cohere(base_prompt, chat_history=chat_history, stream=True):
                    try:
                        chunk_data = json.loads(chunk)
                        if "response" in chunk_data and chunk_data["response"]:
                            full_response += chunk_data["response"]
                            sse_chunk = f"data: {chunk}\n\n"
                            print(f"DEBUG: Sending SSE chunk: {sse_chunk.strip()}")
                            yield sse_chunk
                        elif chunk_data.get("is_finished"):
                            sse_chunk = f"data: {json.dumps({'is_finished': True, 'source_type': source_type, 'sources': sources})}\n\n"
                            print(f"DEBUG: Sending final SSE chunk: {sse_chunk.strip()}")
                            yield sse_chunk
                            break
                    except json.JSONDecodeError as e:
                        print(f"DEBUG: JSON parsing error in normal flow: {e}")
                        continue

            # Save assistant response to DB after streaming is complete
            if full_response:  # Only save if we got a response
                save_message(request.session_id, "assistant", full_response, request.username, source_type=source_type, sources=sources)
                
        except Exception as e:
            print(f"ERROR in stream_response: {e}")
            # Send error message to frontend
            error_chunk = f"data: {json.dumps({'error': 'An error occurred while processing your request', 'is_finished': True})}\n\n"
            yield error_chunk

    # Return StreamingResponse with proper SSE headers
    return StreamingResponse(
        stream_response(), 
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control, Content-Type",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
        }
    )


@app.get("/chat")
async def chat_get(
    session_id: str = Query(...),
    message: str = Query(...),
    username: str = Query(...)
):
    request = ChatRequest(session_id=session_id, message=message, username=username)
    return await chat(request)

# === Session History Endpoints ===
@app.get("/sessions")
def get_sessions(username: str):
    pipeline = [
        {"$match": {"username": username}},
        {"$sort": {"created_at": 1}},
        {"$group": {
            "_id": "$session_id",
            "first_message": {"$first": "$message"},
            "created_at": {"$first": "$created_at"}
        }},
        {"$sort": {"created_at": -1}}
    ]
    sessions = list(collection.aggregate(pipeline))
    return [{"session_id": s["_id"], "preview": s["first_message"]} for s in sessions]

@app.get("/chat/{session_id}")
def get_session_messages(session_id: str, username: str):
    return get_chat_history(session_id, username)

# Add this endpoint to your existing FastAPI backend (after your other endpoints)

@app.delete("/sessions/{session_id}")
def delete_session(session_id: str, username: str = Query(...)):
    """Delete a chat session and all its messages"""
    try:
        # Delete all messages for this session from MongoDB
        result = collection.delete_many({
            "session_id": session_id, 
            "username": username
        })
        
        # Check if any documents were deleted
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Session not found or no messages to delete")
        
        return {
            "message": f"Session deleted successfully. Removed {result.deleted_count} messages.",
            "session_id": session_id,
            "deleted_count": result.deleted_count
        }
        
    except Exception as e:
        print(f"Error deleting session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete session: {str(e)}")

# # Optional: Add endpoint to delete all sessions for a user (bulk delete)
# @app.delete("/sessions")
# def delete_all_sessions(username: str = Query(...)):
#     """Delete all chat sessions for a user"""
#     try:
#         result = collection.delete_many({"username": username})
        
#         if result.deleted_count == 0:
#             raise HTTPException(status_code=404, detail="No sessions found for this user")
        
#         return {
#             "message": f"All sessions deleted successfully. Removed {result.deleted_count} messages.",
#             "deleted_count": result.deleted_count
#         }
        
#     except Exception as e:
#         print(f"Error deleting all sessions for user {username}: {e}")
#         raise HTTPException(status_code=500, detail=f"Failed to delete sessions: {str(e)}")

# Add these to your existing FastAPI backend

from pydantic import BaseModel

# Add this model for rename request
class RenameSessionRequest(BaseModel):
    new_name: str

@app.put("/sessions/{session_id}/rename")
def rename_session(session_id: str, request: RenameSessionRequest, username: str = Query(...)):
    """Rename a chat session by updating the first user message"""
    try:
        new_name = request.new_name.strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="New name cannot be empty")
        
        # Find the first user message in this session and update it
        # This will change what appears in the session preview
        result = collection.update_one(
            {
                "session_id": session_id, 
                "username": username, 
                "role": "user"
            },
            {
                "$set": {"message": new_name}
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Session not found or no user messages to rename")
        
        return {
            "message": "Session renamed successfully",
            "session_id": session_id,
            "new_name": new_name,
            "modified_count": result.modified_count
        }
        
    except Exception as e:
        print(f"Error renaming session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to rename session: {str(e)}")

# === Auth Endpoints ===
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_user(username: str):
    return user_collection.find_one({"username": username})

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def hash_password(password):
    return pwd_context.hash(password)

@app.post("/signup")
def signup(credentials: UserCredentials):
    if get_user(credentials.username):
        raise HTTPException(status_code=400, detail="Username already exists")
    hashed_pwd = hash_password(credentials.password)
    user_collection.insert_one({"username": credentials.username, "password": hashed_pwd})
    return {"message": "Signup successful"}

@app.post("/login")
def login(credentials: UserCredentials):
    user = get_user(credentials.username)
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"message": "Login successful"}