# The Space Game — prototype HTML/CSS/JS

Ce dépôt contient une première ébauche de prototype inspiré de la spec de The Space Game :
- vue de dessus
- astéroïdes extractibles
- bâtiments à poser
- production d’énergie
- collecte de minéraux
- ennemis et défense
- interface HUD simple

## Démarrage rapide

Ouvrez simplement le fichier `index.html` dans un navigateur.

Pour un serveur local plus propre :

```bash
python3 -m http.server 8000
```

Puis ouvrir :

```text
http://localhost:8000
```

## Fichiers

- `index.html` — structure de la vue et HUD
- `style.css` — palette et interface sombre de style space strategy
- `script.js` — logique de jeu, génération, ressources, ennemis, projectiles

## Objectif du prototype

Cette version ne vise pas à reproduire exactement la mécanique du jeu original, mais à proposer une base jouable et fidèle à l’esprit de la spécification :
- réseau de bâtiments
- collecte et énergie
- vagues ennemies
- défense par lasers et missiles

## Prochaine étape possible

On peut ensuite pousser le prototype vers une version plus riche avec :
- mini-carte
- sélecteur de bâtiment détaillé
- upgrade/recycle
- plusieurs vagues et types ennemis
- graphes de progression
- stratégie plus proche de la spec complète
