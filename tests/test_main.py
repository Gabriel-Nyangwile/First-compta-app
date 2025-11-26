"""Tests for the main routes."""

import pytest


class TestMainRoutes:
    """Test main routes."""

    def test_index_page(self, client):
        """Test that the index page loads."""
        response = client.get('/')
        assert response.status_code == 200
        assert b'Tableau de Bord' in response.data or b'OHADA' in response.data

    def test_about_page(self, client):
        """Test that the about page loads."""
        response = client.get('/about')
        assert response.status_code == 200
        assert b'OHADA' in response.data

    def test_accounts_page(self, client):
        """Test that the accounts list page loads."""
        response = client.get('/accounts/')
        assert response.status_code == 200

    def test_journal_page(self, client):
        """Test that the journal page loads."""
        response = client.get('/journal/')
        assert response.status_code == 200
