"""Main routes for the accounting application."""

from flask import Blueprint, render_template
from app.models import Account, JournalEntry

bp = Blueprint('main', __name__)


@bp.route('/')
def index():
    """Home page with dashboard."""
    total_accounts = Account.query.count()
    total_entries = JournalEntry.query.count()
    recent_entries = JournalEntry.query.order_by(
        JournalEntry.created_at.desc()
    ).limit(5).all()

    return render_template('index.html',
                           total_accounts=total_accounts,
                           total_entries=total_entries,
                           recent_entries=recent_entries)


@bp.route('/about')
def about():
    """About page with OHADA information."""
    return render_template('about.html')
