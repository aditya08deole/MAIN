from typing import Dict, Any, List

class LLMService:
    """
    Service to interact with LLM Provider (OpenAI/Gemini).
    Currently a mockery for demonstration.
    """
    async def generate_response(
        self, 
        prompt: str, 
        context: Dict[str, Any],
        history: List[Dict[str, str]] = []
    ) -> str:
        """
        Generate AI response based on context and user prompt.
        """
        # In a real implementation:
        # system_prompt = f"You are Evara Assistant. Context: {json.dumps(context)}"
        # response = openai.ChatCompletion.create(...)
        
        # Mocks
        prompt_lower = prompt.lower()
        user_name = context.get("user", {}).get("name", "User")
        
        if "hello" in prompt_lower:
            return f"Hello {user_name}! How can I help you with your water monitoring today?"
        
        if "alert" in prompt_lower:
            alerts = context.get("alerts", [])
            if alerts:
                count = len(alerts)
                return f"You have {count} active alerts. The most recent one is on Node {alerts[0]['node_id']}."
            else:
                return "Good news! There are no active alerts regarding your systems."
                
        if "status" in prompt_lower or "summary" in prompt_lower:
            nodes = context.get("nodes", [])
            online = sum(1 for n in nodes if n["status"] == "Online")
            return f"System Summary: You have {len(nodes)} nodes total, with {online} currently online."
            
        return f"I received your request: '{prompt}'. As an AI assistant, I have access to your system data and can help investigate issues."
