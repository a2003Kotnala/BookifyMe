from flask import Blueprint, request, jsonify
from backend.models.users import User
from backend.models.books import Book

users_bp = Blueprint('users', __name__)

@users_bp.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        name = data.get('name')
        email = data.get('email')
        password = data.get('password')
        
        if not name or not email or not password:
            return jsonify({'error': 'Missing required fields'}), 400
        
        user_id = User.create_user(name, email, password)
        
        if user_id:
            token = User.generate_token(user_id)
            return jsonify({
                'message': 'User created successfully',
                'token': token,
                'user': {
                    'id': user_id,
                    'name': name,
                    'email': email
                }
            }), 201
        else:
            return jsonify({'error': 'Failed to create user'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@users_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'error': 'Missing email or password'}), 400
        
        user = User.authenticate_user(email, password)
        
        if user:
            token = User.generate_token(user['id'])
            return jsonify({
                'message': 'Login successful',
                'token': token,
                'user': user
            }), 200
        else:
            return jsonify({'error': 'Invalid credentials'}), 401
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@users_bp.route('/profile', methods=['GET'])
def get_profile():
    try:
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        user_id = User.verify_token(token.split(' ')[1] if ' ' in token else token)
        if not user_id:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        user = User.get_user_by_id(user_id)
        if user:
            # Get user's bookshelf stats
            reading = Book.get_user_books(user_id, 'reading')
            want_to_read = Book.get_user_books(user_id, 'want_to_read')
            history = Book.get_user_books(user_id, 'history')
            
            # Calculate stats
            pages_read = sum(book.get('pageCount', 0) for book in history)
            genres = set()
            for shelf in [reading, want_to_read, history]:
                for book in shelf:
                    if 'categories' in book:
                        genres.update(book['categories'])
            
            return jsonify({
                'user': user,
                'stats': {
                    'booksRead': len(history),
                    'pagesRead': pages_read,
                    'genresExplored': len(genres),
                    'groups': 0  # You can implement this later
                }
            }), 200
        else:
            return jsonify({'error': 'User not found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500