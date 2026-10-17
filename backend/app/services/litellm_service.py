import json
import logging
import httpx
from typing import Dict, Any, Optional, List
from app.core.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Tu es l'assistant IA officiel de GroupEvent (écosystème oussamma.tn).
Ton rôle est d'aider les utilisateurs à planifier et réussir leurs événements de groupe :
- Proposition de listes de courses concrètes (avec quantités, unités et rayons/catégories) adaptées au nombre de convives et au budget.
- Idées de menus et recettes simples pour grands groupes (barbecue, pique-nique, dîner, soirée, week-end).
- Conseils d'organisation et optimisation du budget partagé.
- Réponds toujours en français, avec clarté, bienveillance et pragmatisme.

Si l'utilisateur demande une liste de courses ou d'ingrédients, inclus en fin de réponse un bloc JSON strict au format :
```json
{
  "groceries": [
    {"name": "Merguez", "quantity": 1.5, "unit": "kg", "category": "Boucherie & Poissonnerie", "estimated_price": 18.0},
    {"name": "Pains burger", "quantity": 12, "unit": "pièce", "category": "Épicerie Salée", "estimated_price": 5.0}
  ]
}
```
Les catégories valides sont : "Fruits & Légumes", "Boucherie & Poissonnerie", "Produits Frais & Laitiers", "Épicerie Salée", "Épicerie Sucrée", "Boissons", "Hygiène & Entretien", "Autre".
"""

class LiteLLMService:
    @staticmethod
    async def chat(prompt: str, context: Optional[str] = None) -> Dict[str, Any]:
        url = f"{settings.LITELLM_BASE_URL.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.LITELLM_API_KEY}",
            "Content-Type": "application/json"
        }

        user_content = prompt
        if context:
            user_content = f"Contexte de l'événement :\n{context}\n\nDemande de l'utilisateur :\n{prompt}"

        models_to_try = [
            settings.LITELLM_DEFAULT_MODEL,
            "gpt-4o-mini",
            "gemini/gemini-3.1-flash-lite-preview",
            "chatgpt/gpt-5.4"
        ]

        last_error = None
        for model in models_to_try:
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_content}
                ],
                "temperature": 0.4,
                "max_tokens": 1200
            }

            try:
                async with httpx.AsyncClient(timeout=25.0) as client:
                    resp = await client.post(url, headers=headers, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        raw_content = data["choices"][0]["message"]["content"]
                        
                        # Extract JSON groceries if present
                        suggested_groceries = None
                        if "```json" in raw_content:
                            try:
                                json_part = raw_content.split("```json")[1].split("```")[0].strip()
                                parsed = json.loads(json_part)
                                suggested_groceries = parsed.get("groceries")
                            except Exception as e:
                                logger.warning(f"Could not parse grocery JSON: {e}")

                        return {
                            "content": raw_content,
                            "suggested_groceries": suggested_groceries,
                            "model_used": model
                        }
                    else:
                        last_error = f"HTTP {resp.status_code}: {resp.text[:200]}"
            except Exception as e:
                last_error = str(e)
                logger.warning(f"Model {model} failed: {e}")

        # Fallback response in case LiteLLM is offline
        return {
            "content": f"Bonjour ! L'assistant IA a rencontré un ralentissement passager ({last_error}). Voici un conseil général pour vos courses : prévoyez 250g de viande/poisson et 150g de féculents par personne.",
            "suggested_groceries": None,
            "model_used": "fallback"
        }
