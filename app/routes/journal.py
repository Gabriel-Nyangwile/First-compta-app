"""Routes for journal entry management."""

from flask import Blueprint, request, jsonify, render_template
from app import db
from app.models import Account, JournalEntry, JournalLine
from datetime import datetime

bp = Blueprint('journal', __name__, url_prefix='/journal')


@bp.route('/')
def list_entries():
    """List all journal entries."""
    entries = JournalEntry.query.order_by(JournalEntry.date.desc()).all()

    if request.headers.get('Accept') == 'application/json':
        return jsonify([entry.to_dict() for entry in entries])

    return render_template('journal/list.html', entries=entries)


@bp.route('/api')
def api_list_entries():
    """API endpoint to list all journal entries as JSON."""
    entries = JournalEntry.query.order_by(JournalEntry.date.desc()).all()
    return jsonify([entry.to_dict() for entry in entries])


@bp.route('/api/<int:entry_id>')
def api_get_entry(entry_id):
    """API endpoint to get a single journal entry."""
    entry = JournalEntry.query.get_or_404(entry_id)
    return jsonify(entry.to_dict())


@bp.route('/api', methods=['POST'])
def api_create_entry():
    """API endpoint to create a new journal entry with lines."""
    data = request.get_json()

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    required_fields = ['reference', 'description', 'lines']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400

    # Check if reference already exists
    if JournalEntry.query.filter_by(reference=data['reference']).first():
        return jsonify({'error': 'Reference already exists'}), 400

    # Validate lines
    if not data['lines'] or len(data['lines']) < 2:
        return jsonify({'error': 'At least two lines required for double-entry'}), 400

    # Parse date
    entry_date = datetime.now().date()
    if 'date' in data and data['date']:
        try:
            entry_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    # Create journal entry
    entry = JournalEntry(
        reference=data['reference'],
        date=entry_date,
        description=data['description']
    )

    # Add lines
    total_debit = 0
    total_credit = 0

    for line_data in data['lines']:
        if 'account_id' not in line_data:
            return jsonify({'error': 'Each line must have an account_id'}), 400

        account = Account.query.get(line_data['account_id'])
        if not account:
            return jsonify({'error': f"Account {line_data['account_id']} not found"}), 400

        debit = float(line_data.get('debit', 0) or 0)
        credit = float(line_data.get('credit', 0) or 0)

        if debit < 0 or credit < 0:
            return jsonify({'error': 'Debit and credit must be positive'}), 400

        if debit > 0 and credit > 0:
            return jsonify({'error': 'A line cannot have both debit and credit'}), 400

        line = JournalLine(
            account_id=line_data['account_id'],
            description=line_data.get('description', ''),
            debit=debit,
            credit=credit
        )
        entry.lines.append(line)
        total_debit += debit
        total_credit += credit

    # Check balance
    if abs(total_debit - total_credit) >= 0.01:
        return jsonify({
            'error': 'Journal entry must be balanced (total debit = total credit)',
            'total_debit': total_debit,
            'total_credit': total_credit
        }), 400

    entry.is_balanced = True

    db.session.add(entry)
    db.session.commit()

    return jsonify(entry.to_dict()), 201


@bp.route('/api/<int:entry_id>/post', methods=['POST'])
def api_post_entry(entry_id):
    """API endpoint to post a journal entry (make it permanent)."""
    entry = JournalEntry.query.get_or_404(entry_id)

    if entry.is_posted:
        return jsonify({'error': 'Entry is already posted'}), 400

    if not entry.is_balanced:
        return jsonify({'error': 'Cannot post an unbalanced entry'}), 400

    entry.is_posted = True
    db.session.commit()

    return jsonify(entry.to_dict())


@bp.route('/api/<int:entry_id>', methods=['DELETE'])
def api_delete_entry(entry_id):
    """API endpoint to delete a journal entry."""
    entry = JournalEntry.query.get_or_404(entry_id)

    if entry.is_posted:
        return jsonify({'error': 'Cannot delete a posted entry'}), 400

    db.session.delete(entry)
    db.session.commit()

    return jsonify({'message': 'Journal entry deleted successfully'})
