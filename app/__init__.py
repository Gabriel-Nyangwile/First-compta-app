"""
Application de Comptabilité OHADA
Une application de gestion comptable basée sur le système OHADA
(Organisation pour l'Harmonisation en Afrique du Droit des Affaires)
"""

from flask import Flask
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def create_app(config=None):
    """Factory function to create the Flask application."""
    app = Flask(__name__)

    # Default configuration
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///comptabilite.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = 'dev-secret-key-change-in-production'

    # Override with custom config if provided
    if config:
        app.config.update(config)

    # Initialize extensions
    db.init_app(app)

    # Register blueprints
    from app.routes import main, accounts, journal
    app.register_blueprint(main.bp)
    app.register_blueprint(accounts.bp)
    app.register_blueprint(journal.bp)

    # Create database tables
    with app.app_context():
        db.create_all()

    return app
