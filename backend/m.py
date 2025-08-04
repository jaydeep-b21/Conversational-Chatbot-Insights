from pymongo import MongoClient
import re

client = MongoClient("mongodb://localhost:27017")
db = client["chatdb"]
collection = db["chat_history"]

# Step 1: Find all user messages
user_msgs = collection.find({"role": "user"}).sort("created_at", 1)

# Step 2: Loop through and check for assistant response or delete matched messages
for user_msg in user_msgs:
    session_id = user_msg["session_id"]
    created_at = user_msg["created_at"]
    user_text = user_msg["message"].strip().lower()

    # Match loosely on a known phrase
    if "400 l" in user_text:
        # Delete the user message
        result1 = collection.delete_one({"_id": user_msg["_id"]})
        print(f"🗑️ Deleted user message: '{user_msg['message']}'" if result1.deleted_count else "❌ Failed to delete user message")

        # Find and delete the next assistant message
        assistant_msg = collection.find_one({
            "role": "assistant",
            "session_id": session_id,
            "created_at": {"$gt": created_at}
        }, sort=[("created_at", 1)])

        if assistant_msg:
            result2 = collection.delete_one({"_id": assistant_msg["_id"]})
            print(f"🗑️ Deleted assistant reply: '{assistant_msg['message']}'" if result2.deleted_count else "❌ Failed to delete assistant reply")

        continue  # Skip to next user message

    # Check for unanswered user messages
    assistant_msg = collection.find_one({
        "role": "assistant",
        "session_id": session_id,
        "created_at": {"$gt": created_at}
    }, sort=[("created_at", 1)])

    if not assistant_msg:
        print(f"❌ No response to user message: '{user_msg['message']}' ✔️")

print("Check complete.")
