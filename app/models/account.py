"""
Account model for OHADA chart of accounts (Plan comptable OHADA).

Le plan comptable OHADA comprend 9 classes:
- Classe 1: Ressources durables (Capitaux propres et dettes financières)
- Classe 2: Actif immobilisé
- Classe 3: Stocks
- Classe 4: Tiers
- Classe 5: Trésorerie
- Classe 6: Charges des activités ordinaires
- Classe 7: Produits des activités ordinaires
- Classe 8: Autres charges et produits
- Classe 9: Comptes de la comptabilité analytique
"""

from app import db
from datetime import datetime


class AccountClass(db.Model):
    """Classe de compte OHADA."""
    __tablename__ = 'account_classes'

    id = db.Column(db.Integer, primary_key=True)
    number = db.Column(db.Integer, unique=True, nullable=False)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    accounts = db.relationship('Account', backref='account_class', lazy=True)

    def __repr__(self):
        return f'<AccountClass {self.number}: {self.name}>'

    def to_dict(self):
        return {
            'id': self.id,
            'number': self.number,
            'name': self.name,
            'description': self.description
        }


class Account(db.Model):
    """Compte comptable OHADA."""
    __tablename__ = 'accounts'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(20), unique=True, nullable=False)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    class_id = db.Column(db.Integer, db.ForeignKey('account_classes.id'), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    journal_lines = db.relationship('JournalLine', backref='account', lazy=True)

    def __repr__(self):
        return f'<Account {self.code}: {self.name}>'

    def to_dict(self):
        return {
            'id': self.id,
            'code': self.code,
            'name': self.name,
            'description': self.description,
            'class_id': self.class_id,
            'class_number': self.account_class.number if self.account_class else None,
            'is_active': self.is_active
        }

    @property
    def balance(self):
        """Calculate the current balance of the account."""
        debit_total = sum(line.debit or 0 for line in self.journal_lines)
        credit_total = sum(line.credit or 0 for line in self.journal_lines)

        # For classes 1-5 (Balance sheet accounts), debit increases assets
        # For classes 6-8 (Income statement accounts), debit increases expenses
        if self.account_class and self.account_class.number in [1, 4, 5]:
            # Passif/Trésorerie: crédit - débit
            return credit_total - debit_total
        else:
            # Actif/Charges/Produits: débit - crédit
            return debit_total - credit_total
