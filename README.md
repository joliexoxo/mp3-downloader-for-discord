# Discord Music Downloader

Bot Node.js avec `/download url:` et `/stats`. Les commandes sont disponibles avec une installation sur un profil Discord ou sur un serveur.

`/history` affiche uniquement à l'utilisateur ses téléchargements réussis, dans une réponse privée : titre, artiste, format, lien et date. Cinq résultats par page, du plus récent au plus ancien ; `/history page:2` affiche la suite. L'historique est conservé dans SQLite avec les statistiques. Les téléchargements antérieurs à cette fonctionnalité ne sont pas récupérables par utilisateur : seul le compteur global était enregistré.

Après `/download url:…`, un embed affiche un menu **MP3, FLAC, WAV ou OGG**. Seule la personne qui a lancé la commande peut choisir, pendant 60 secondes. Le téléchargement démarre après son choix, puis le bot envoie le fichier dans le format sélectionné. OGG utilise Vorbis. FLAC et WAV ne restaurent pas la qualité perdue par la source et peuvent dépasser la limite Discord. La miniature est intégrée au fichier sauf en WAV.

## Configuration Discord

1. Dans le [Developer Portal](https://discord.com/developers/applications), ouvrir l'application.
2. Dans **Bot**, copier le token dans `DISCORD_TOKEN` du fichier `.env`.
3. Dans **General Information**, copier l'Application ID dans `CLIENT_ID`.
4. Dans **Installation > Installation Contexts**, activer **User Install** et **Guild Install**.
5. Choisir **Discord Provided Link**. Pour User Install, ajouter le scope `applications.commands`. Pour Guild Install, ajouter `bot` et `applications.commands`, avec les permissions View Channels, Send Messages, Attach Files et Embed Links.
6. Utiliser le lien d'installation pour ajouter l'application au profil ou au serveur.

Les commandes globales sont enregistrées au démarrage avec `integration_types: [0, 1]` et `contexts: [0, 1, 2]`. Aucun intent privilégié n'est nécessaire. Aucune URL d'interactions HTTP n'est nécessaire : le bot utilise la connexion Gateway.

## Docker sur VPS

Prérequis : Docker Engine et le plugin Docker Compose.

```bash
cd mp3-downloader-for-discord
cp .env.example .env
nano .env
# Renseigner DISCORD_TOKEN et CLIENT_ID, puis :
docker compose up -d --build
docker compose logs -f --tail=100 bot
```

Si `.env` existe déjà, le modifier directement sans le remplacer. Ne jamais partager le token. `.env`, les cookies, les téléchargements et la base locale sont exclus du contexte Docker.

L'image installe Node.js 24, ffmpeg et yt-dlp avec ses composants JavaScript. Elle tourne avec un utilisateur non root. Aucun port entrant n'est à ouvrir. Le bot redémarre automatiquement et les statistiques SQLite persistent dans le volume `bot-data`. Les nouveaux déploiements commencent avec une base vide ; `data/stats.db` du dépôt n'est pas importé automatiquement.

```bash
# Arrêt, sans suppression des statistiques
docker compose down
# Après récupération de modifications
docker compose up -d --build
# Actualiser également l'image de base et yt-dlp
docker compose build --pull --no-cache
docker compose up -d
```

Ne pas utiliser `docker compose down -v` si les statistiques doivent être conservées.

### Cookies facultatifs

Si une plateforme exige une session, utiliser un fichier au format Netscape. Ajouter au service `bot` dans `compose.yaml` :

```yaml
    volumes:
      - bot-data:/app/data
      - ./cookies.txt:/app/cookies.txt
```

Le fichier doit exister et être accessible en écriture par l'utilisateur du conteneur (UID 1000), car yt-dlp peut actualiser les cookies. Ne pas monter le fichier en lecture seule. Définir `COOKIES_PATH=/app/cookies.txt` dans `.env`.

## Installation locale

Prérequis : Node.js 24, Python avec `yt-dlp[default]`, ffmpeg, tous accessibles dans le PATH.

```bash
npm ci
cp .env.example .env
# Renseigner le token et l'Application ID
npm start
```

Sous PowerShell, utiliser `Copy-Item .env.example .env` pour créer la configuration.

Variables optionnelles : `FFMPEG_PATH`, `YTDLP_PATH` et `COOKIES_PATH`. Avec Docker, elles désignent des chemins à l'intérieur du conteneur.

## Fonctionnement et limites

Le titre et la cover YouTube/SoundCloud sont chargés via oEmbed pendant l'extraction des informations audio. Si oEmbed échoue, le bot utilise les métadonnées de yt-dlp. Un cache mémoire limité à 64 liens pendant 2 minutes partage les requêtes identiques. Le téléchargement réutilise les informations extraites et privilégie un flux audio seul.

- YouTube, SoundCloud et les sources reconnues par yt-dlp ; disponibilité selon la plateforme et le réseau du VPS.
- Spotify sert à récupérer les métadonnées puis à rechercher un équivalent sur YouTube. Pour un album ou une playlist Spotify, seul le premier titre est traité.
- Conversion MP3, FLAC, WAV ou OGG avec métadonnées ; aucune clé SoundCloud n'est utilisée.
- Un dossier temporaire distinct par téléchargement, nettoyé après l'envoi ou en cas d'erreur. Un arrêt brutal peut laisser des fichiers temporaires dans le conteneur.
- La taille maximale suit la limite fournie par l'interaction Discord (10 Mio par défaut).
- Métadonnées : délai maximal 2 minutes ; téléchargement et conversion : 10 minutes.
- Utiliser uniquement les contenus dont le téléchargement est autorisé.

Si le démarrage échoue, vérifier `.env`, l'activation des deux contextes d'installation Discord et les logs. Si YouTube échoue, reconstruire l'image pour actualiser yt-dlp ; certains VPS peuvent nécessiter des cookies ou subir des restrictions réseau de la plateforme.
