"""Routes for account management."""

from flask import Blueprint, request, jsonify, render_template
from app import db
from app.models import Account, AccountClass

bp = Blueprint('accounts', __name__, url_prefix='/accounts')


@bp.route('/')
def list_accounts():
    """List all accounts."""
    accounts = Account.query.order_by(Account.code).all()
    classes = AccountClass.query.order_by(AccountClass.number).all()

    if request.headers.get('Accept') == 'application/json':
        return jsonify([acc.to_dict() for acc in accounts])

    return render_template('accounts/list.html', accounts=accounts, classes=classes)


@bp.route('/api')
def api_list_accounts():
    """API endpoint to list all accounts as JSON."""
    accounts = Account.query.order_by(Account.code).all()
    return jsonify([acc.to_dict() for acc in accounts])


@bp.route('/api/<int:account_id>')
def api_get_account(account_id):
    """API endpoint to get a single account."""
    account = Account.query.get_or_404(account_id)
    return jsonify(account.to_dict())


@bp.route('/api', methods=['POST'])
def api_create_account():
    """API endpoint to create a new account."""
    data = request.get_json()

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    required_fields = ['code', 'name', 'class_id']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400

    # Check if account code already exists
    if Account.query.filter_by(code=data['code']).first():
        return jsonify({'error': 'Account code already exists'}), 400

    # Verify class exists
    account_class = AccountClass.query.get(data['class_id'])
    if not account_class:
        return jsonify({'error': 'Account class not found'}), 400

    account = Account(
        code=data['code'],
        name=data['name'],
        description=data.get('description', ''),
        class_id=data['class_id'],
        is_active=data.get('is_active', True)
    )

    db.session.add(account)
    db.session.commit()

    return jsonify(account.to_dict()), 201


@bp.route('/api/<int:account_id>', methods=['PUT'])
def api_update_account(account_id):
    """API endpoint to update an account."""
    account = Account.query.get_or_404(account_id)
    data = request.get_json()

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    if 'code' in data and data['code'] != account.code:
        existing = Account.query.filter_by(code=data['code']).first()
        if existing:
            return jsonify({'error': 'Account code already exists'}), 400
        account.code = data['code']

    if 'name' in data:
        account.name = data['name']
    if 'description' in data:
        account.description = data['description']
    if 'is_active' in data:
        account.is_active = data['is_active']

    db.session.commit()
    return jsonify(account.to_dict())


@bp.route('/api/<int:account_id>', methods=['DELETE'])
def api_delete_account(account_id):
    """API endpoint to delete an account."""
    account = Account.query.get_or_404(account_id)

    # Check if account has journal lines
    if account.journal_lines:
        return jsonify({'error': 'Cannot delete account with journal entries'}), 400

    db.session.delete(account)
    db.session.commit()

    return jsonify({'message': 'Account deleted successfully'})


@bp.route('/classes/api')
def api_list_classes():
    """API endpoint to list all account classes."""
    classes = AccountClass.query.order_by(AccountClass.number).all()
    return jsonify([cls.to_dict() for cls in classes])
