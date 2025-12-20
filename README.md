# OP! - Santé financière des parents

Site web de la plateforme OP! - La 1ère plateforme de santé financière pour les parents.

## 🎯 À propos

OP! aide les parents à comprendre l'argent et à investir en confiance grâce à :
- Des quiz gratuits
- Des ateliers ludiques
- Un accompagnement personnalisé (optionnel)

## 📁 Structure

```
op-parents/
├── index.html              # Page d'accueil
├── assets/
│   ├── css/
│   │   └── style.css      # Styles principaux
│   ├── js/
│   │   └── main.js        # JavaScript
│   └── images/            # Images (à ajouter)
├── robots.txt
├── sitemap.xml
└── README.md
```

## 🚀 Déploiement

### 1. Local → GitHub

```bash
cd ~/Téléchargements/op-parents
git add .
git commit -m "Update site"
git push origin main
```

### 2. GitHub → Render (automatique)

Le site se déploie automatiquement sur :
- **Production** : https://op-parents.fr
- **Dev** : https://op-parents-dev.onrender.com (branche dev)

### 3. Workflow dev → prod

```bash
# Travailler sur dev
git checkout dev
# ... modifications ...
git add .
git commit -m "Description"
git push origin dev

# Tester sur op-parents-dev.onrender.com

# Si OK, merger dans main
git checkout main
git merge dev
git push origin main

# Production se met à jour automatiquement
```

## ✅ Checklist

### Avant mise en ligne
- [ ] Remplacer les dates d'ateliers
- [ ] Ajouter logo OP! dans /assets/images/
- [ ] Ajouter illustrations/photos
- [ ] Configurer formulaire (service email)
- [ ] Créer mentions légales
- [ ] Créer politique de confidentialité

### Après mise en ligne
- [ ] Tester sur mobile
- [ ] Vérifier HTTPS actif
- [ ] Google Search Console
- [ ] Google Analytics (optionnel)
- [ ] Créer comptes Instagram/LinkedIn

## 🎨 Personnalisation

### Couleurs (CSS)

```css
--primary-blue: #4A90E2;  /* Bleu principal */
--coral: #FF6B6B;         /* Corail (ateliers, accents) */
--mint: #51CF66;          /* Vert menthe (futurs accents) */
```

### Contenu à personnaliser

1. **Dates des ateliers** : Dans index.html, section `#ateliers`
2. **Formulaire quiz** : Connecter à un service (FormSpree, Netlify Forms, etc.)
3. **Liens réseaux sociaux** : Footer

## 📊 Performance

- HTML/CSS pur = très rapide
- Score PageSpeed attendu : 95+
- Mobile-first design

## 📞 Support

Pour toute question :
- Email : contact@op-parents.fr
- Instagram : @op.parents

## 📄 Licence

© 2024 OP! - Tous droits réservés
