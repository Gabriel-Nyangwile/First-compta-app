"""
Initialize the OHADA chart of accounts database.

This script creates the account classes and a basic set of accounts
following the OHADA (SYSCOHADA) standards.
"""

from app import create_app, db
from app.models import AccountClass, Account


def init_ohada_classes():
    """Create the 9 OHADA account classes."""
    classes = [
        (1, "Ressources durables", "Capitaux propres et dettes financières"),
        (2, "Actif immobilisé", "Immobilisations incorporelles, corporelles et financières"),
        (3, "Stocks", "Stocks et en-cours"),
        (4, "Tiers", "Fournisseurs, clients, personnel, État, associés"),
        (5, "Trésorerie", "Banque, caisse, valeurs mobilières de placement"),
        (6, "Charges des activités ordinaires", "Achats, services extérieurs, impôts, charges de personnel"),
        (7, "Produits des activités ordinaires", "Ventes, prestations de services, produits accessoires"),
        (8, "Autres charges et produits", "Charges et produits hors activités ordinaires"),
        (9, "Comptabilité analytique", "Comptes de la comptabilité analytique de gestion"),
    ]

    for number, name, description in classes:
        existing = AccountClass.query.filter_by(number=number).first()
        if not existing:
            account_class = AccountClass(
                number=number,
                name=name,
                description=description
            )
            db.session.add(account_class)

    db.session.commit()
    print(f"Created {len(classes)} account classes")


def init_basic_accounts():
    """Create a basic set of OHADA accounts."""
    accounts = [
        # Classe 1 - Ressources durables
        ("101", "Capital social", 1),
        ("106", "Réserves", 1),
        ("120", "Résultat de l'exercice (bénéfice)", 1),
        ("129", "Résultat de l'exercice (perte)", 1),
        ("161", "Emprunts obligataires", 1),
        ("162", "Emprunts auprès des établissements de crédit", 1),

        # Classe 2 - Actif immobilisé
        ("211", "Frais de développement", 2),
        ("213", "Logiciels", 2),
        ("215", "Fonds commercial", 2),
        ("231", "Bâtiments", 2),
        ("232", "Installations et agencements des bâtiments", 2),
        ("241", "Matériel industriel", 2),
        ("244", "Matériel et mobilier de bureau", 2),
        ("245", "Matériel de transport", 2),
        ("251", "Terrains", 2),
        ("274", "Prêts au personnel", 2),
        ("275", "Dépôts et cautionnements versés", 2),

        # Classe 3 - Stocks
        ("311", "Marchandises", 3),
        ("321", "Matières premières", 3),
        ("322", "Matières consommables", 3),
        ("331", "Produits en cours", 3),
        ("361", "Produits finis", 3),

        # Classe 4 - Tiers
        ("401", "Fournisseurs", 4),
        ("408", "Fournisseurs - Factures non parvenues", 4),
        ("411", "Clients", 4),
        ("418", "Clients - Produits non encore facturés", 4),
        ("421", "Personnel - Rémunérations dues", 4),
        ("422", "Personnel - Avances et acomptes", 4),
        ("431", "Sécurité sociale", 4),
        ("441", "État - Impôt sur les bénéfices", 4),
        ("443", "État - TVA facturée", 4),
        ("445", "État - TVA récupérable", 4),
        ("471", "Comptes d'attente à régulariser", 4),

        # Classe 5 - Trésorerie
        ("512", "Banque", 5),
        ("514", "Chèques postaux", 5),
        ("520", "Banques, comptes à terme", 5),
        ("531", "Chèques à encaisser", 5),
        ("571", "Caisse", 5),
        ("585", "Virements de fonds", 5),

        # Classe 6 - Charges des activités ordinaires
        ("601", "Achats de marchandises", 6),
        ("602", "Achats de matières premières", 6),
        ("604", "Achats d'emballages", 6),
        ("605", "Autres achats", 6),
        ("611", "Transports sur achats", 6),
        ("612", "Transports sur ventes", 6),
        ("622", "Locations", 6),
        ("624", "Entretien, réparations et maintenance", 6),
        ("625", "Primes d'assurances", 6),
        ("627", "Publicité, publications, relations publiques", 6),
        ("628", "Frais de télécommunications", 6),
        ("631", "Frais bancaires", 6),
        ("641", "Impôts et taxes directs", 6),
        ("645", "Impôts et taxes indirects", 6),
        ("661", "Rémunérations directes versées au personnel", 6),
        ("664", "Charges sociales", 6),
        ("671", "Intérêts des emprunts", 6),
        ("681", "Dotations aux amortissements", 6),

        # Classe 7 - Produits des activités ordinaires
        ("701", "Ventes de marchandises", 7),
        ("702", "Ventes de produits finis", 7),
        ("703", "Ventes de produits intermédiaires", 7),
        ("704", "Travaux facturés", 7),
        ("705", "Études et prestations de services", 7),
        ("706", "Produits accessoires", 7),
        ("707", "Produits des activités annexes", 7),
        ("771", "Intérêts de prêts", 7),
        ("773", "Escomptes obtenus", 7),
        ("781", "Reprises d'amortissements", 7),
        ("791", "Reprises sur provisions", 7),

        # Classe 8 - Autres charges et produits
        ("811", "Valeur comptable des cessions d'immobilisations", 8),
        ("812", "Valeur comptable des cessions de titres", 8),
        ("821", "Produits des cessions d'immobilisations", 8),
        ("822", "Produits des cessions de titres", 8),
        ("831", "Charges sur exercices antérieurs", 8),
        ("841", "Produits sur exercices antérieurs", 8),
        ("871", "Participation des travailleurs", 8),
        ("891", "Impôts sur le résultat", 8),
    ]

    created_count = 0
    for code, name, class_number in accounts:
        account_class = AccountClass.query.filter_by(number=class_number).first()
        if account_class:
            existing = Account.query.filter_by(code=code).first()
            if not existing:
                account = Account(
                    code=code,
                    name=name,
                    class_id=account_class.id
                )
                db.session.add(account)
                created_count += 1

    db.session.commit()
    print(f"Created {created_count} accounts")


def init_database():
    """Initialize the database with OHADA chart of accounts."""
    app = create_app()
    with app.app_context():
        db.create_all()
        init_ohada_classes()
        init_basic_accounts()
        print("Database initialized successfully!")


if __name__ == '__main__':
    init_database()
