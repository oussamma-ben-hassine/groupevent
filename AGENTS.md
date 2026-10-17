# Directives Agents & Développeurs — GroupEvent

## Rôles & Responsabilités
Ce projet fait partie de l'écosystème unifié `oussamma.tn`. Tout agent ou développeur intervenant sur ce dépôt doit respecter scrupuleusement les règles suivantes :

1. **Intégrité de la Base de Données (Zéro Fake Data)** :
   - Ne jamais injecter de données de démonstration ou d'utilisateurs factices en production ou en développement standard.
   - Les fixtures ne doivent exister que dans des suites de tests unitaires/intégration exécutées en mémoire ou sur base temporaire.

2. **Authentification & Permissions Multi-acteurs** :
   - Deux types d'acteurs accèdent à l'application : Utilisateurs enregistrés SSO et Invités temporaires (Guest).
   - Les invités ont des permissions strictement restreintes à l'événement auquel ils ont été conviés via le token hashé.
   - Toute nouvelle route API doit vérifier `actor` via `Depends(get_current_actor)`.

3. **Intégrations Écosystème** :
   - Tout appel à un service de l'écosystème (SSO, LiteLLM, Drive, Supervisor) doit comporter un fallback non-bloquant en cas d'indisponibilité passagère.

4. **Conventions Graphiques** :
   - Police `Plus Jakarta Sans` pour le corps de texte et titres.
   - Police `JetBrains Mono` pour les données numériques et badges techniques.
   - Couleur primaire : Bleu (`#2563eb`).
   - Support strict du mode sombre (`dark:` Tailwind).
