Placez vos polices locales ici.

Recommandations:
- Ajouter les fichiers .woff2 (format prioritaire) et éventuellement .woff pour fallback.
- Éviter .ttf/.otf en production (taille plus grande) sauf si besoin de glyphes spécifiques.
- Nommer les familles de manière stable: ex: "Inter" / "InterVariable".
- Fournir variantes Regular (400), Medium (500), SemiBold (600), Bold (700) selon besoins UI.

Sous-ensemble (subsetting):
- Pour réduire la taille, générer un sous-ensemble latin (et éventuellement latin-ext) via outils comme glyphhanger ou fonttools.

Exemple de commandes (indicatif):
 glyphhanger --subset=./Inter.ttf --US-ASCII --formats=woff2

Après ajout, déclarez les @font-face dans src/app/globals.css ou utilisez next/font/local.
