"""Tests for the journal entry models and API."""

import pytest
from app import db
from app.models import Account, AccountClass, JournalEntry, JournalLine


class TestJournalEntry:
    """Test JournalEntry model."""

    def setup_accounts(self, app):
        """Setup test accounts."""
        with app.app_context():
            # Create account classes
            class5 = AccountClass(number=5, name="Trésorerie")
            class6 = AccountClass(number=6, name="Charges")
            db.session.add_all([class5, class6])
            db.session.commit()

            # Create accounts
            banque = Account(code="512", name="Banque", class_id=class5.id)
            achats = Account(code="601", name="Achats de marchandises", class_id=class6.id)
            db.session.add_all([banque, achats])
            db.session.commit()

            return banque.id, achats.id

    def test_create_journal_entry(self, app):
        """Test creating a journal entry."""
        banque_id, achats_id = self.setup_accounts(app)

        with app.app_context():
            entry = JournalEntry(
                reference="ACH-001",
                description="Achat de marchandises"
            )
            db.session.add(entry)
            db.session.commit()

            retrieved = JournalEntry.query.filter_by(reference="ACH-001").first()
            assert retrieved is not None
            assert retrieved.description == "Achat de marchandises"
            assert retrieved.is_balanced is False

    def test_journal_entry_balance_check(self, app):
        """Test balance checking for journal entries."""
        banque_id, achats_id = self.setup_accounts(app)

        with app.app_context():
            entry = JournalEntry(
                reference="ACH-001",
                description="Achat de marchandises"
            )
            db.session.add(entry)

            # Add balanced lines
            line1 = JournalLine(
                journal_entry=entry,
                account_id=achats_id,
                debit=1000,
                credit=0
            )
            line2 = JournalLine(
                journal_entry=entry,
                account_id=banque_id,
                debit=0,
                credit=1000
            )
            db.session.add_all([line1, line2])
            db.session.commit()

            assert entry.total_debit == 1000
            assert entry.total_credit == 1000
            assert entry.check_balance() is True

    def test_journal_entry_to_dict(self, app):
        """Test JournalEntry to_dict method."""
        banque_id, achats_id = self.setup_accounts(app)

        with app.app_context():
            entry = JournalEntry(
                reference="ACH-001",
                description="Achat de marchandises"
            )
            line = JournalLine(
                journal_entry=entry,
                account_id=banque_id,
                debit=500,
                credit=0
            )
            db.session.add_all([entry, line])
            db.session.commit()

            data = entry.to_dict()
            assert data['reference'] == "ACH-001"
            assert data['total_debit'] == 500
            assert len(data['lines']) == 1


class TestJournalAPI:
    """Test journal API endpoints."""

    def setup_accounts_for_api(self, app):
        """Setup accounts for API tests."""
        with app.app_context():
            class5 = AccountClass(number=5, name="Trésorerie")
            class6 = AccountClass(number=6, name="Charges")
            db.session.add_all([class5, class6])
            db.session.commit()

            banque = Account(code="512", name="Banque", class_id=class5.id)
            achats = Account(code="601", name="Achats", class_id=class6.id)
            db.session.add_all([banque, achats])
            db.session.commit()

            return banque.id, achats.id

    def test_list_entries_empty(self, client):
        """Test listing journal entries when empty."""
        response = client.get('/journal/api')
        assert response.status_code == 200
        assert response.json == []

    def test_create_entry_missing_data(self, client):
        """Test creating entry with missing data."""
        response = client.post('/journal/api',
                               json={'reference': 'ACH-001'},
                               content_type='application/json')
        assert response.status_code == 400
        assert 'error' in response.json

    def test_create_entry_unbalanced(self, client, app):
        """Test that unbalanced entries are rejected."""
        banque_id, achats_id = self.setup_accounts_for_api(app)

        response = client.post('/journal/api',
                               json={
                                   'reference': 'ACH-001',
                                   'description': 'Achat',
                                   'lines': [
                                       {'account_id': achats_id, 'debit': 1000, 'credit': 0},
                                       {'account_id': banque_id, 'debit': 0, 'credit': 500}
                                   ]
                               },
                               content_type='application/json')
        assert response.status_code == 400
        assert 'balanced' in response.json['error'].lower()

    def test_create_entry_success(self, client, app):
        """Test creating a balanced journal entry."""
        banque_id, achats_id = self.setup_accounts_for_api(app)

        response = client.post('/journal/api',
                               json={
                                   'reference': 'ACH-001',
                                   'description': 'Achat de marchandises',
                                   'date': '2024-01-15',
                                   'lines': [
                                       {'account_id': achats_id, 'debit': 1000, 'credit': 0},
                                       {'account_id': banque_id, 'debit': 0, 'credit': 1000}
                                   ]
                               },
                               content_type='application/json')
        assert response.status_code == 201
        assert response.json['reference'] == 'ACH-001'
        assert response.json['is_balanced'] is True
        assert len(response.json['lines']) == 2

    def test_post_entry(self, client, app):
        """Test posting a journal entry."""
        banque_id, achats_id = self.setup_accounts_for_api(app)

        # Create entry
        create_response = client.post('/journal/api',
                                      json={
                                          'reference': 'ACH-001',
                                          'description': 'Achat',
                                          'lines': [
                                              {'account_id': achats_id, 'debit': 1000, 'credit': 0},
                                              {'account_id': banque_id, 'debit': 0, 'credit': 1000}
                                          ]
                                      },
                                      content_type='application/json')
        entry_id = create_response.json['id']

        # Post entry
        post_response = client.post(f'/journal/api/{entry_id}/post')
        assert post_response.status_code == 200
        assert post_response.json['is_posted'] is True

    def test_delete_posted_entry(self, client, app):
        """Test that posted entries cannot be deleted."""
        banque_id, achats_id = self.setup_accounts_for_api(app)

        # Create and post entry
        create_response = client.post('/journal/api',
                                      json={
                                          'reference': 'ACH-001',
                                          'description': 'Achat',
                                          'lines': [
                                              {'account_id': achats_id, 'debit': 1000, 'credit': 0},
                                              {'account_id': banque_id, 'debit': 0, 'credit': 1000}
                                          ]
                                      },
                                      content_type='application/json')
        entry_id = create_response.json['id']
        client.post(f'/journal/api/{entry_id}/post')

        # Try to delete
        delete_response = client.delete(f'/journal/api/{entry_id}')
        assert delete_response.status_code == 400
        assert 'posted' in delete_response.json['error'].lower()
