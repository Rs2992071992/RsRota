## DÉMARRAGE DE SESSION
1. Lire tasks/lessons.md — appliquer toutes les leçons avant de toucher quoi que ce soit
2. Lire tasks/todo.md — comprendre l'état actuel
3. Si aucun des deux n'existe, les créer avant de commencer

## CONTEXTE PROJET

### Boutique
- URL : ube-ube.com (store : nthauq-j0.myshopify.com)
- Thème : Whisk (thème payant, Online Store 2.0)
- Société : PEGO SAS

### Produit
- Poudre d'ube 100% pure (igname violet des Philippines)
- Produit principal : latte d'ube
- Positionnement premium, marché français

### Priorités techniques actuelles
1. Performance / Core Web Vitals (CLS en priorité)
2. Amélioration des sections existantes
3. Pas de refonte complète — modifications chirurgicales

### Ce qu'il ne faut pas toucher
- `config/settings_data.json` (customisations live du marchand)
- Les apps tierces existantes (Pandectes GDPR, etc.)

## WORKFLOW

### 1. Planifier d'abord
- Passer en mode plan pour toute tâche non triviale (3+ étapes)
- Écrire le plan dans tasks/todo.md avant d'implémenter
- Si quelque chose ne va pas, STOP et re-planifier — ne jamais forcer

### 2. Stratégie sous-agents
- Utiliser des sous-agents pour garder le contexte principal propre
- Une tâche par sous-agent
- Investir plus de compute sur les problèmes difficiles

### 3. Boucle d'auto-amélioration
- Après toute correction : mettre à jour tasks/lessons.md
- Format : [date] | ce qui a mal tourné | règle pour l'éviter
- Relire les leçons à chaque démarrage de session

### 4. Standard de vérification
- Ne jamais marquer comme terminé sans preuve que ça fonctionne
- Lancer les tests, vérifier les logs, comparer le comportement
- Se demander : « Est-ce qu'un staff engineer validerait ça ? »

### 5. Exiger l'élégance
- Pour les changements non triviaux : existe-t-il une solution plus élégante ?
- Si un fix semble bricolé : le reconstruire proprement
- Ne pas sur-ingénieriser les choses simples

### 6. Correction de bugs autonome
- Quand on reçoit un bug : le corriger directement
- Aller dans les logs, trouver la cause racine, résoudre
- Pas besoin d'être guidé étape par étape

## RÈGLES SHOPIFY
- Ne jamais modifier le thème live directement
- Toujours travailler sur le thème de développement
- Lancer `shopify theme check` avant chaque commit
- Préférer `{% render %}` à `{% include %}` (déprécié)
- Valider le JSON des schemas avant tout push
- Commits petits et ciblés — un changement logique par commit
- **Après chaque modification de fichier(s), fournir la commande push ciblée** :
  ```
  shopify theme push --store nthauq-j0.myshopify.com --only chemin/fichier1.liquid chemin/fichier2.css
  ```
  Ne jamais donner `shopify theme push` sans `--only` (pousse tout le thème).

## PRINCIPES FONDAMENTAUX
- Simplicité d'abord — toucher un minimum de code
- Pas de paresse — causes racines uniquement, pas de fixes temporaires
- Ne jamais supposer — vérifier chemins, APIs, variables avant utilisation
- Demander une seule fois — une question en amont si nécessaire, ne jamais interrompre en cours de tâche

## GESTION DES TÂCHES
1. Planifier → tasks/todo.md
2. Vérifier → confirmer avant d'implémenter
3. Suivre → marquer comme terminé au fur et à mesure
4. Expliquer → résumé de haut niveau à chaque étape
5. Apprendre → tasks/lessons.md après corrections

## APPRENTISSAGES
(Claude remplit cette section au fil du temps)