# 🚀 GUIDE ÉTAPE PAR ÉTAPE - Mise en ligne OP!

## ✅ ÉTAPE 1 : Copier les fichiers dans ton dossier local (2 min)

1. **Télécharge le ZIP** que je te fournis
2. **Dézippe-le** dans ton dossier `Téléchargements/`
3. **Renomme** le dossier en `op-parents` (si ce n'est pas déjà fait)

**Structure finale :**
```
~/Téléchargements/op-parents/
├── index.html
├── assets/
│   ├── css/style.css
│   ├── js/main.js
│   └── images/ (vide pour le moment)
├── robots.txt
├── sitemap.xml
└── README.md
```

---

## ✅ ÉTAPE 2 : Pousser sur GitHub (3 min)

### Ouvrir VS Code

1. Ouvre **Visual Studio Code**
2. File → Open Folder → `Téléchargements/op-parents`

### Terminal dans VS Code

Ouvre le terminal (Ctrl + ù ou Terminal → New Terminal) et tape :

```bash
# Vérifier que tu es bien dans le dossier
pwd
# Doit afficher : /Users/ton-nom/Téléchargements/op-parents

# Ajouter tous les fichiers
git add .

# Commit
git commit -m "Site OP! initial - Design fun et pédagogique"

# Push sur main
git push origin main
```

**✅ Vérification :**
- Va sur https://github.com/cavaillesflorent-lab/op-parents.fr
- Tu dois voir tous les fichiers

---

## ✅ ÉTAPE 3 : Déployer sur Render (5 min)

### Créer le service PRODUCTION

1. Va sur [render.com](https://render.com)
2. Connexion avec ton compte GitHub
3. Dashboard → **"New +"** → **"Static Site"**
4. Sélectionne le repo **`op-parents.fr`**

### Configuration

```
Name:              op-parents-prod
Branch:            main
Root Directory:    (laisser vide)
Build Command:     (laisser vide)
Publish Directory: .
Auto-Deploy:       Yes ✅
```

5. Clique sur **"Create Static Site"**
6. **Attendre 1-2 minutes** → Site déployé !

**URL temporaire générée :**
`https://op-parents-prod.onrender.com`

### ✅ TEST

Ouvre `https://op-parents-prod.onrender.com` → Le site doit s'afficher ! 🎉

---

## ✅ ÉTAPE 4 : Créer le service DEV (optionnel, 3 min)

Répète l'opération avec :

```
Name:              op-parents-dev
Branch:            dev
Root Directory:    (laisser vide)
Build Command:     (laisser vide)
Publish Directory: .
Auto-Deploy:       Yes ✅
```

**URL dev :** `https://op-parents-dev.onrender.com`

---

## ✅ ÉTAPE 5 : Configurer le domaine op-parents.fr (10 min)

### A. Dans Render

1. Service **op-parents-prod** → **Settings**
2. Section **Custom Domains**
3. Clique sur **"Add Custom Domain"**
4. Ajouter :
   - `op-parents.fr`
   - `www.op-parents.fr`

**Render va afficher les enregistrements DNS**, par exemple :

```
Pour op-parents.fr :
Type: A
Name: @
Value: 76.76.21.21

Pour www.op-parents.fr :
Type: CNAME
Name: www
Value: op-parents-prod.onrender.com
```

**⚠️ IMPORTANT : Note ces valeurs, on en a besoin pour l'étape suivante !**

---

### B. Dans o2switch

1. **Connexion à o2switch**
   - Va sur ton espace client o2switch
   - Cherche **"Gestion DNS"** ou **"Zone DNS"**

2. **Ajouter enregistrement A**
   ```
   Type: A
   Nom: @ (ou laisser vide)
   Valeur: [IP donnée par Render, ex: 76.76.21.21]
   TTL: 3600 (ou défaut)
   ```

3. **Ajouter enregistrement CNAME**
   ```
   Type: CNAME
   Nom: www
   Valeur: op-parents-prod.onrender.com
   TTL: 3600 (ou défaut)
   ```

4. **Sauvegarder**

---

### C. Attendre la propagation DNS

**Délai :** 5 minutes à 48 heures (généralement < 2h)

**Vérifier la propagation :**
1. Va sur [dnschecker.org](https://dnschecker.org)
2. Tape `op-parents.fr`
3. Type : **A**
4. Vérifie que ça pointe vers l'IP Render

---

### D. Activer HTTPS

**Automatique !** Render génère un certificat SSL Let's Encrypt gratuit.

**Délai :** 5 min à 2h après propagation DNS

**✅ Vérification finale :**
1. Ouvre `https://op-parents.fr`
2. Le cadenas vert doit apparaître ✅
3. Site accessible et sécurisé ! 🎉

---

## 🔄 WORKFLOW QUOTIDIEN

### Modifier le site

1. **Ouvrir VS Code** sur le dossier `op-parents`
2. **Modifier les fichiers** (HTML, CSS, JS)
3. **Tester en local** : Ouvrir `index.html` dans ton navigateur

### Pousser sur dev pour tester

```bash
git checkout dev
git add .
git commit -m "Description des changements"
git push origin dev
```

**→ Tester sur :** `https://op-parents-dev.onrender.com`

### Mettre en production

```bash
git checkout main
git merge dev
git push origin main
```

**→ Production se met à jour automatiquement sur :** `https://op-parents.fr`

---

## ✅ CHECKLIST POST-LANCEMENT

### Immédiat (aujourd'hui)

- [ ] Vérifier `https://op-parents.fr` fonctionne
- [ ] Test mobile (téléphone)
- [ ] Test vitesse : [pagespeed.web.dev](https://pagespeed.web.dev)

### Semaine 1

- [ ] Ajouter logo OP! (fichier PNG)
- [ ] Ajouter photos/illustrations
- [ ] Remplacer dates d'ateliers
- [ ] Configurer formulaire quiz (FormSpree ou autre)
- [ ] Créer mentions légales
- [ ] Créer politique de confidentialité

### Semaine 2

- [ ] Google Search Console
- [ ] Soumettre sitemap
- [ ] Google Analytics (optionnel)
- [ ] Créer Instagram @op.parents
- [ ] Premiers posts selon ta stratégie

---

## 🆘 TROUBLESHOOTING

### Le site ne s'affiche pas sur Render

1. Vérifier le **Deploy Log** dans Render
2. Si erreur, regarder le message
3. Généralement : problème de path ou fichier manquant

### DNS ne se propage pas

1. Attendre 24h max
2. Vider cache DNS local :
   ```bash
   # Mac
   sudo dscacheutil -flushcache
   
   # Windows
   ipconfig /flushdns
   ```

### HTTPS pas actif

1. Vérifier que DNS est propagé
2. Attendre jusqu'à 2h
3. Si toujours rien : Supprimer et re-ajouter le domaine dans Render

---

## 📞 Besoin d'aide ?

Si tu bloques :
1. Regarde les **Deploy Logs** sur Render
2. Vérifie que tous les fichiers sont bien sur GitHub
3. Assure-toi d'avoir bien configuré les DNS sur o2switch

---

## 🎉 PROCHAINES ÉTAPES

Une fois le site en ligne :

1. **Contenu**
   - Ajouter vraies dates ateliers
   - Photos famille/parents
   - Témoignages (si tu en as)

2. **Marketing**
   - Lancer Instagram avec ta stratégie
   - Premiers posts carrousels pédagogiques
   - Partager le quiz

3. **Fonctionnalités**
   - Système d'inscription ateliers
   - Quiz interactif complet
   - Espace membre (futur)

---

**Bon courage Florent ! Tu vas y arriver ! 💪**

**Temps total estimé : 30 minutes** ⏱️
