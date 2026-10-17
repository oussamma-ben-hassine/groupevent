# GroupEvent — Application de Gestion d'Événements, Courses Partagées et Dépenses

GroupEvent (`https://group.oussamma.tn`) est une application web moderne et responsive, conçue pour organiser facilement des événements de groupe, gérer les listes de courses partagées en temps réel et simplifier les remboursements de dépenses entre participants.

---

## 🚀 Fonctionnalités Clés

1. **Gestion d'Événements Multi-modes**
   - Événements privés avec gestion des membres et rôles (organisateur, membre, invité).
   - Partage par lien sécurisé (`/invite/<token>`) avec QR code, Web Share, WhatsApp, Telegram, email.
   - 3 modes de participation : Privé, Connexion SSO, Invité immédiat (sans compte, session isolée).
   - Aucun compte fictif ni fausse donnée au démarrage.

2. **Courses Partagées & Mode Supermarché**
   - Liste de courses avec catégorisation (Fruits & Légumes, Boissons, Épicerie, etc.).
   - Attribution des articles aux participants.
   - Coche en magasin en un clic.
   - Conversion automatique des articles achetés en dépense partagée.

3. **Partage des Dépenses & Algorithme de Simplification de Dettes**
   - Répartition équitable ou personnalisée par participant.
   - Justificatifs de paiement avec upload ByteVault Drive (et stockage local de secours).
   - Algorithme de règlement optimal réduisant le nombre total de virements nécessaires.
   - Enregistrement des remboursements en direct.

4. **Assistant IA Écosystème (LiteLLM)**
   - Suggestions de menus, estimation de quantités et génération de listes de courses.
   - Découpage intelligent de recettes avec insertion directe dans la liste de courses.

5. **Expérience Utilisateur & PWA**
   - Thème visuel inspiré de `oussamma.tn` (Plus Jakarta Sans, JetBrains Mono, `#2563eb`).
   - Mode clair et sombre avec détection automatique du système.
   - Design mobile-first avec barre de navigation inférieure et sidebar desktop.
   - Application Web Progressive (PWA) installable avec Service Worker.

---

## 🛠️ Architecture & Stack Technique

- **Frontend** : React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, Google Material Symbols.
- **Backend** : FastAPI (Python 3.11), SQLAlchemy Async (asyncpg), Pydantic v2.
- **Base de données** : PostgreSQL 16.
- **Cache & Sessions** : Redis 7.
- **Reverse Proxy** : Nginx (Alpine).
- **Intégrations Écosystème oussamma.tn** :
  - **SSO** : `sso-a.oussamma.tn` (OAuth2 / OIDC avec PKCE).
  - **LiteLLM Gateway** : `ai.oussamma.tn/v1` (modèle `gpt-4o-mini`).
  - **Drive Storage** : `drive.oussamma.tn` (ByteVault Drive API).
  - **Supervisor** : `supervisor.oussamma.tn` (Audit & télémétrie centralisée).
  - **Portail Principal** : `oussamma.tn` (Enregistré dans le catalogue applicatif).

---

## 📦 Déploiement Docker & Coolify

GroupEvent est packagé sous forme de stack Docker Compose autonome :

```bash
# Lancement local
docker compose up -d --build
```

Services inclus :
- `postgres` (Port interne 5432)
- `redis` (Port interne 6379)
- `backend` (FastAPI sur port 8000)
- `worker` (Tâches asynchrones de nettoyage et expiration des tokens)
- `frontend` (Nginx servant le build Vite et routant `/api` et `/auth`)
