import requests

# --- Configuration ---

# SERP API Config
SERP_API_KEY = "68ad7d52c518c9e05af9698a722827845c34a11c0771ab5e97099427c64f609a"  # Replace this with your actual SERP API key
SERP_API_URL = "https://serpapi.com/search"

# Cohere API Config
COHERE_API_KEY = "sNvH7BXlEGHdhomPtEalgqEGRJZiQxnMEEV2pEsX"
COHERE_API_URL = "https://api.cohere.ai/v1/chat"
HEADERS = {
    "Authorization": f"Bearer {COHERE_API_KEY}",
    "Content-Type": "application/json"
}

# --- Web Search via SERP API ---
def serp_search(query):
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
        return "No relevant search results found."

    snippets = []
    for item in results:
        title = item.get("title", "")
        snippet = item.get("snippet", "")
        link = item.get("link", "")
        snippets.append(f"{title}: {snippet}\n{link}")

    return "\n\n".join(snippets)

# --- Ask Cohere LLM ---
def ask_gpt(prompt):
    payload = {
        "message": prompt,
        "model": "command-r-plus",
        "temperature": 0.5,
        "max_tokens": 1000
    }
    response = requests.post(COHERE_API_URL, json=payload, headers=HEADERS)
    if response.status_code == 200:
        return response.json().get("text", "[No response]")
    else:
        print("Error:", response.status_code, response.text)
        return "[Error from LLM]"

# --- Decide if the Query Needs Web Search ---
def needs_web_search(query):
    check_prompt = (
        f"Is the following question about a current or recent event that would require up-to-date "
        f"information from the internet? Respond only with 'yes' or 'no'.\n\nQuestion: {query}"
    )
    payload = {
        "message": check_prompt,
        "model": "command-r-plus",
        "temperature": 0,
        "max_tokens": 10
    }
    response = requests.post(COHERE_API_URL, json=payload, headers=HEADERS)
    if response.status_code == 200:
        answer = response.json().get("text", "").strip().lower()
        return answer.startswith("yes")
    else:
        print("Error in needs_web_search:", response.status_code, response.text)
        return False

# --- Main Logic ---
def get_answer(query):
    if needs_web_search(query):
        print("→ Using web search")
        web_data = serp_search(query)
        context = f"From the web:\n{web_data}"
        prompt = f"{context}\n\nAnswer the question: {query}"
    else:
        print("→ Using LLM only")
        prompt = query

    return ask_gpt(prompt)

# --- Run ---
if __name__ == "__main__":
    query = input("Ask something:\n")
    if query.strip():
        answer = get_answer(query)
        print("\n💬 Answer:")
        print(answer)
