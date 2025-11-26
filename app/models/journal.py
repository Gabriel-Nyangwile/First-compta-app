"""
Journal entry models for accounting transactions.

An accounting journal entry consists of:
- A header (JournalEntry) with date, reference, and description
- Multiple lines (JournalLine) with debits and credits
- Total debits must equal total credits (principle of double-entry bookkeeping)
"""

from app import db
from datetime import datetime, date


class JournalEntry(db.Model):
    """Écriture comptable (journal entry header)."""
    __tablename__ = 'journal_entries'

    id = db.Column(db.Integer, primary_key=True)
    reference = db.Column(db.String(50), unique=True, nullable=False)
    date = db.Column(db.Date, nullable=False, default=date.today)
    description = db.Column(db.String(500), nullable=False)
    is_balanced = db.Column(db.Boolean, default=False)
    is_posted = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lines = db.relationship('JournalLine', backref='journal_entry', lazy=True,
                            cascade='all, delete-orphan')

    def __repr__(self):
        return f'<JournalEntry {self.reference}: {self.description}>'

    def to_dict(self):
        return {
            'id': self.id,
            'reference': self.reference,
            'date': self.date.isoformat() if self.date else None,
            'description': self.description,
            'is_balanced': self.is_balanced,
            'is_posted': self.is_posted,
            'lines': [line.to_dict() for line in self.lines],
            'total_debit': self.total_debit,
            'total_credit': self.total_credit
        }

    @property
    def total_debit(self):
        """Calculate total debit amount."""
        return sum(line.debit or 0 for line in self.lines)

    @property
    def total_credit(self):
        """Calculate total credit amount."""
        return sum(line.credit or 0 for line in self.lines)

    def check_balance(self):
        """Check if the journal entry is balanced (debits = credits)."""
        self.is_balanced = abs(self.total_debit - self.total_credit) < 0.01
        return self.is_balanced


class JournalLine(db.Model):
    """Ligne d'écriture comptable (journal entry line)."""
    __tablename__ = 'journal_lines'

    id = db.Column(db.Integer, primary_key=True)
    journal_entry_id = db.Column(db.Integer, db.ForeignKey('journal_entries.id'), nullable=False)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=False)
    description = db.Column(db.String(200))
    debit = db.Column(db.Float, default=0)
    credit = db.Column(db.Float, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<JournalLine Account:{self.account_id} D:{self.debit} C:{self.credit}>'

    def to_dict(self):
        return {
            'id': self.id,
            'journal_entry_id': self.journal_entry_id,
            'account_id': self.account_id,
            'account_code': self.account.code if self.account else None,
            'account_name': self.account.name if self.account else None,
            'description': self.description,
            'debit': self.debit,
            'credit': self.credit
        }
