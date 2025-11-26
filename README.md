# Application de Comptabilité OHADA

Une application de gestion comptable basée sur le système OHADA (Organisation pour l'Harmonisation en Afrique du Droit des Affaires).

## 📋 Description

Cette application permet de gérer la comptabilité selon les normes OHADA (SYSCOHADA), incluant:

- **Plan comptable OHADA** avec les 9 classes de comptes
- **Gestion des comptes** (création, modification, suppression)
- **Journal comptable** avec écritures en partie double
- **API REST** pour l'intégration avec d'autres systèmes
- **Interface web** moderne et responsive

## 🏗️ Structure du Plan Comptable OHADA

Le plan comptable comprend 9 classes:

| Classe | Nom | Description |
|--------|-----|-------------|
| 1 | Ressources durables | Capitaux propres et dettes financières |
| 2 | Actif immobilisé | Immobilisations incorporelles, corporelles et financières |
| 3 | Stocks | Stocks et en-cours |
| 4 | Tiers | Fournisseurs, clients, personnel, État |
| 5 | Trésorerie | Banque, caisse, valeurs mobilières |
| 6 | Charges des activités ordinaires | Achats, services, charges de personnel |
| 7 | Produits des activités ordinaires | Ventes, prestations de services |
| 8 | Autres charges et produits | Charges et produits hors activités ordinaires |
| 9 | Comptabilité analytique | Comptes de la comptabilité analytique |

## 🚀 Installation

### Prérequis

- Python 3.8 ou supérieur
- pip (gestionnaire de paquets Python)

### Installation des dépendances

```bash
# Cloner le repository
git clone https://github.com/Gabriel-Nyangwile/First-compta-app.git
cd First-compta-app

# Créer un environnement virtuel (recommandé)
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou
venv\Scripts\activate  # Windows

# Installer les dépendances
pip install -r requirements.txt
```

### Initialisation de la base de données

```bash
# Initialiser la base de données avec le plan comptable OHADA
python init_db.py
```

### Lancement de l'application

```bash
python run.py
```

L'application sera accessible à l'adresse: http://localhost:5000

## 📡 API Endpoints

### Comptes

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/accounts/api` | Liste tous les comptes |
| GET | `/accounts/api/<id>` | Détails d'un compte |
| POST | `/accounts/api` | Créer un compte |
| PUT | `/accounts/api/<id>` | Modifier un compte |
| DELETE | `/accounts/api/<id>` | Supprimer un compte |
| GET | `/accounts/classes/api` | Liste des classes de comptes |

### Journal

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/journal/api` | Liste toutes les écritures |
| GET | `/journal/api/<id>` | Détails d'une écriture |
| POST | `/journal/api` | Créer une écriture |
| POST | `/journal/api/<id>/post` | Comptabiliser une écriture |
| DELETE | `/journal/api/<id>` | Supprimer une écriture (non comptabilisée) |

### Exemple de création d'écriture

```json
POST /journal/api
{
    "reference": "ACH-001",
    "date": "2024-01-15",
    "description": "Achat de marchandises",
    "lines": [
        {"account_id": 1, "debit": 10000, "credit": 0},
        {"account_id": 2, "debit": 0, "credit": 10000}
    ]
}
```

## 🧪 Tests

```bash
# Exécuter les tests
pytest

# Exécuter les tests avec couverture
pytest --cov=app tests/
```

## 📁 Structure du projet

```
First-compta-app/
├── app/
│   ├── __init__.py          # Configuration Flask
│   ├── models/
│   │   ├── account.py       # Modèles Account et AccountClass
│   │   └── journal.py       # Modèles JournalEntry et JournalLine
│   ├── routes/
│   │   ├── main.py          # Routes principales
│   │   ├── accounts.py      # Routes des comptes
│   │   └── journal.py       # Routes du journal
│   ├── templates/           # Templates HTML (Jinja2)
│   └── static/              # Fichiers statiques (CSS)
├── tests/                   # Tests unitaires
├── init_db.py              # Script d'initialisation
├── run.py                  # Point d'entrée
├── requirements.txt        # Dépendances Python
└── README.md
```

## 📜 Licence

Ce projet est sous licence MIT.

## 👥 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.
