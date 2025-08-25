from flask import Flask
from flask_mysqldb import MySQL
from flask_cors import CORS
from backend.config import Config
from backend.routes.users_routes import users_bp
from backend.routes.books_routes import books_bp
import sys
import os

# Add the project root to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Initialize Flask app
app = Flask(__name__)
app.config.from_object(Config)

# Initialize MySQL
mysql = MySQL(app)

# Enable CORS
CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:3000"])

# Register blueprints
app.register_blueprint(users_bp, url_prefix='/api/users')
app.register_blueprint(books_bp, url_prefix='/api/books')

@app.route('/')
def hello():
    return 'BookifyMe API is running!'

if __name__ == '__main__':
    app.run(debug=True, port=5000)