# Qui est la plus ? 💗

Petite plateforme de jeu multijoueur pour une soirée d'anniversaire :
l'écran est projeté au vidéoprojecteur, les participantes votent depuis leur téléphone.

Un seul jeu dans cette V1 : **Qui est la plus ?**
(le jeu « Oui ou non — sans débattre » se joue physiquement, il n'est pas dans l'app).

---

## Démarrage rapide

```bash
npm install
npm run build      # compile le serveur + les bundles navigateur
npm start          # http://localhost:3000
```

En développement (rechargement à chaud du serveur, pas de build serveur nécessaire) :

```bash
npm run build:client   # une fois, puis à chaque modif de src/client
npm run dev            # http://localhost:3000
```

Vérification complète (à lancer avant la soirée) :

```bash
npm run verify   # lint + typecheck + build + tests
```

### Le soir de la soirée

1. Sur l'ordinateur relié au vidéoprojecteur : ouvrir `http://<adresse-du-serveur>:3000`, cliquer **CRÉER UNE PARTIE**.
2. Cliquer **Modifier les prénoms** et saisir les vrais prénoms (18 prénoms de démo sont préchargés).
3. Projeter le lobby : QR code + code à 4 lettres.
4. Les filles scannent le QR code, choisissent leur prénom, et apparaissent à l'écran.
5. **C'EST PARTI 💗** → une question s'affiche, les votes arrivent en direct (le détail reste caché).
6. **Fermer les votes** (optionnel) puis **RÉVÉLER 👀** → décompte 3-2-1, gagnante, podium, commentaire.
7. **QUESTION SUIVANTE →** … et **Terminer la partie** quand vous le souhaitez.

> ⚠️ L'écran hôte doit rester ouvert sur l'appareil qui a créé la partie : le jeton d'hôte
> est stocké dans son `localStorage`. Un simple rafraîchissement de la page ne pose aucun problème.

Si l'ordinateur et les téléphones sont sur le même Wi-Fi, remplacez `localhost` par l'IP locale
de l'ordinateur (`ipconfig` / `ifconfig`) : le QR code utilise automatiquement l'adresse
avec laquelle la page a été ouverte.

---

## Architecture

Volontairement minimale : **un seul process Node**, aucune base de données, aucun compte, aucune auth.

```
Navigateur hôte  ─┐
                  ├── WebSocket (Socket.IO) ── Express ── état en mémoire (Map de Room)
Téléphones (~20) ─┘
```

| Choix | Pourquoi |
| --- | --- |
| Node 20+ / Express / Socket.IO | temps réel simple et éprouvé, fallback polling automatique sur Safari iOS |
| État **en mémoire** (`Map<code, Room>`) | 20 connexions, une soirée : aucune persistance nécessaire |
| TypeScript partout | la logique de jeu (`src/shared`) est partagée serveur/client et testée |
| Front **vanilla** bundlé par esbuild | pas de framework, pas de hydratation, 6 à 10 ko par page |
| QR code généré côté serveur (`qrcode`) | aucun appel réseau externe, image en `data:` URL |
| Commentaires générés **localement** | aucune API d'IA pendant la partie |

```
src/
  shared/     types, questions, roulement des 6 prénoms, dépouillement, commentaires
  server/     game.ts (moteur de partie, testable seul) + index.ts (HTTP + Socket.IO)
  client/     host.ts (vidéoprojecteur), player.ts (téléphone), landing.ts
public/       html + css + bundles générés (public/js)
test/         38 tests (node:test) dont un test d'intégration à 20 téléphones réels
```

### Roulement équitable des 6 prénoms (`src/shared/rotation.ts`)

À chaque question, exactement 6 prénoms sont proposés parmi les ~20 participantes :

- on ne pioche jamais dans le palier « n+1 apparitions » tant que le palier « n » n'est pas
  épuisé → **l'écart d'apparitions reste toujours ≤ 1** (vérifié sur 40 questions et 5 tailles de groupe) ;
- à l'intérieur d'un palier, les participantes de la question précédente sont fortement pénalisées
  → **0 apparition consécutive** avec 18 participantes ;
- les binômes déjà beaucoup vus ensemble sont pénalisés, et 8 tirages sont comparés pour retenir
  le groupe le plus « neuf » → pas de trio d'équipes figées, les combinaisons tournent ;
- l'ordre d'affichage est remélangé à chaque question.

Une participante ne peut pas voter pour elle-même : si son prénom sort, le bouton est désactivé
sur **son** téléphone uniquement (et le serveur refuse le vote de toute façon).

### Commentaires de résultats

Générés localement à partir de la question, de la gagnante, du pourcentage et de l'écart
avec la deuxième. Le système détecte la « forme » du résultat — `landslide`, `close`, `tie`,
`scattered`, `normal` — ajoute la phrase d'ambiance correspondante, puis pioche parmi les
templates de la question. Ton taquin entre copines : jamais sur le physique, jamais humiliant,
aucun classement de beauté ou de popularité.

### Modifier les questions

Tout est dans **`src/shared/questions.ts`** : `id`, `text`, `category`, `emoji` et les templates
de commentaires (`{winner}`, `{votes}`, `{pct}`, `{second}`, `{gap}`, `{voters}`).
Ajoutez/retirez des entrées, relancez `npm run build`. Les styles de questions sont
automatiquement alternés pendant la partie (jamais plus de 3 questions du même style d'affilée).

---

## Robustesse

| Cas | Comportement |
| --- | --- |
| Refresh du téléphone | `deviceId` persistant en `localStorage` → prénom et vote conservés, pas de second vote |
| Perte de connexion | reconnexion automatique Socket.IO, l'état complet est renvoyé à la reconnexion |
| Double vote | refusé côté serveur (`Tu as déjà voté.`), les boutons sont verrouillés côté téléphone |
| Vote pour soi | bouton désactivé + refus serveur |
| Arrivée tardive | une joueuse peut choisir un prénom et voter tant que les votes sont ouverts |
| Égalités | plusieurs gagnantes affichées, podium à rangs partagés, commentaire dédié |
| Choix à 0 vote | jamais affiché sur le podium |
| Hôte qui recharge | jeton d'hôte en `localStorage`, l'état est renvoyé instantanément |
| Tout le monde a voté | **rien ne se passe** : seul l'hôte déclenche la révélation |
| Fin de partie | statistiques positives (reine du jeu, la plus citée, total de votes) |

---

## Déploiement

L'app a besoin d'**un process Node persistant** (WebSocket + état en mémoire).

**Compatible** : Render, Railway, Fly.io, Koyeb, un VPS, ou tout simplement l'ordinateur
de la soirée sur le Wi-Fi local (le plus fiable : aucune dépendance internet pendant le jeu).

**À éviter** : Vercel / Netlify / Cloudflare Workers en mode *serverless functions*.
Ces plateformes ne gardent pas de WebSocket persistant ni d'état en mémoire entre invocations —
il faudrait alors ajouter Redis + un service temps réel, ce qui va à l'encontre de la simplicité
demandée. (Vercel propose des « fluid/long-running compute », mais ce n'est pas la cible ici.)

Sur une plateforme d'hébergement :

```
Build command : npm install && npm run build
Start command : npm start
```

Variables d'environnement :

| Variable | Rôle |
| --- | --- |
| `PORT` | port d'écoute (défaut `3000`, fourni automatiquement par la plupart des hébergeurs) |
| `PUBLIC_URL` | force l'URL utilisée dans le QR code (utile derrière un proxy/tunnel exotique) |

Pour tester depuis de vrais téléphones sans déployer : `npx localtunnel --port 3000`
(ou ngrok / cloudflared) puis `PUBLIC_URL=https://…` au lancement.

---

## Limites connues

- **État en mémoire** : un redémarrage du serveur efface les parties en cours. Volontaire
  (une soirée = une session), mais ne redémarrez pas le process en plein jeu.
- **Un seul appareil hôte** : le jeton d'hôte vit dans son `localStorage`. Vider les données
  du navigateur ou changer d'appareil oblige à recréer une partie.
- **Pas d'authentification** : n'importe qui ayant le code peut rejoindre et choisir un prénom
  libre. C'est le comportement voulu pour une soirée entre copines.
- **Polices Google Fonts** chargées depuis un CDN : sans internet, l'app fonctionne
  parfaitement mais utilise les polices système (le design reste propre).
- **Changement de prénoms** possible uniquement dans le lobby, pas en cours de partie.
- Les parties inactives depuis 8 h sont supprimées automatiquement.
