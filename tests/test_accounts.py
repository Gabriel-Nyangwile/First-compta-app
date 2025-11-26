"""Tests for the account models and API."""

import pytest
from app import db
from app.models import Account, AccountClass


class TestAccountClass:
    """Test AccountClass model."""

    def test_create_account_class(self, app):
        """Test creating an account class."""
        with app.app_context():
            account_class = AccountClass(
                number=1,
                name="Ressources durables",
                description="Capitaux propres et dettes financières"
            )
            db.session.add(account_class)
            db.session.commit()

            retrieved = AccountClass.query.filter_by(number=1).first()
            assert retrieved is not None
            assert retrieved.name == "Ressources durables"
            assert retrieved.number == 1

    def test_account_class_to_dict(self, app):
        """Test AccountClass to_dict method."""
        with app.app_context():
            account_class = AccountClass(
                number=5,
                name="Trésorerie",
                description="Banque, caisse"
            )
            db.session.add(account_class)
            db.session.commit()

            data = account_class.to_dict()
            assert data['number'] == 5
            assert data['name'] == "Trésorerie"
            assert 'id' in data


class TestAccount:
    """Test Account model."""

    def test_create_account(self, app):
        """Test creating an account."""
        with app.app_context():
            # First create an account class
            account_class = AccountClass(number=5, name="Trésorerie")
            db.session.add(account_class)
            db.session.commit()

            # Then create an account
            account = Account(
                code="512",
                name="Banque",
                class_id=account_class.id
            )
            db.session.add(account)
            db.session.commit()

            retrieved = Account.query.filter_by(code="512").first()
            assert retrieved is not None
            assert retrieved.name == "Banque"
            assert retrieved.account_class.number == 5

    def test_account_unique_code(self, app):
        """Test that account codes must be unique."""
        with app.app_context():
            account_class = AccountClass(number=5, name="Trésorerie")
            db.session.add(account_class)
            db.session.commit()

            account1 = Account(code="512", name="Banque", class_id=account_class.id)
            db.session.add(account1)
            db.session.commit()

            account2 = Account(code="512", name="Autre Banque", class_id=account_class.id)
            db.session.add(account2)

            with pytest.raises(Exception):
                db.session.commit()


class TestAccountsAPI:
    """Test accounts API endpoints."""

    def test_list_accounts_empty(self, client):
        """Test listing accounts when empty."""
        response = client.get('/accounts/api')
        assert response.status_code == 200
        assert response.json == []

    def test_create_account_missing_data(self, client):
        """Test creating account with missing data."""
        response = client.post('/accounts/api',
                               json={'code': '512'},
                               content_type='application/json')
        assert response.status_code == 400
        assert 'error' in response.json

    def test_create_account_success(self, client, app):
        """Test creating an account successfully."""
        with app.app_context():
            # First create an account class
            account_class = AccountClass(number=5, name="Trésorerie")
            db.session.add(account_class)
            db.session.commit()
            class_id = account_class.id

        response = client.post('/accounts/api',
                               json={
                                   'code': '512',
                                   'name': 'Banque',
                                   'class_id': class_id
                               },
                               content_type='application/json')
        assert response.status_code == 201
        assert response.json['code'] == '512'
        assert response.json['name'] == 'Banque'

    def test_list_classes(self, client, app):
        """Test listing account classes."""
        with app.app_context():
            account_class = AccountClass(number=1, name="Ressources durables")
            db.session.add(account_class)
            db.session.commit()

        response = client.get('/accounts/classes/api')
        assert response.status_code == 200
        assert len(response.json) == 1
        assert response.json[0]['number'] == 1
