"""
Application de Comptabilité OHADA - Point d'entrée principal.

Pour lancer l'application:
    python run.py

Pour initialiser la base de données avec le plan comptable OHADA:
    python init_db.py

Pour activer le mode debug (développement uniquement):
    FLASK_DEBUG=1 python run.py
"""

import os
from app import create_app

app = create_app()

if __name__ == '__main__':
    # Debug mode should only be enabled in development via environment variable
    debug_mode = os.environ.get('FLASK_DEBUG', '0') == '1'
    print("=== Application de Comptabilité OHADA ===")
    print("Démarrage sur http://localhost:5000")
    if debug_mode:
        print("Mode debug: ACTIVÉ (développement)")
    print("Appuyez sur Ctrl+C pour arrêter\n")
    app.run(debug=debug_mode, host='0.0.0.0', port=5000)
