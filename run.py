"""
Application de Comptabilité OHADA - Point d'entrée principal.

Pour lancer l'application:
    python run.py

Pour initialiser la base de données avec le plan comptable OHADA:
    python init_db.py
"""

from app import create_app

app = create_app()

if __name__ == '__main__':
    print("=== Application de Comptabilité OHADA ===")
    print("Démarrage sur http://localhost:5000")
    print("Appuyez sur Ctrl+C pour arrêter\n")
    app.run(debug=True, host='0.0.0.0', port=5000)
