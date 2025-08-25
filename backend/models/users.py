from flask import jsonify
from backend import mysql
import bcrypt
import jwt
import datetime
from backend.config import Config

class User:
    @staticmethod
    def create_user(name, email, password):
        try:
            # Hash password
            hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
            
            conn = mysql.connection
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO users (name, email, password_hash) VALUES (%s, %s, %s)",
                (name, email, hashed_password)
            )
            conn.commit()
            user_id = cursor.lastrowid
            cursor.close()
            
            return user_id
        except Exception as e:
            print(f"Error creating user: {e}")
            return None

    @staticmethod
    def authenticate_user(email, password):
        try:
            conn = mysql.connection
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, name, email, password_hash FROM users WHERE email = %s",
                (email,)
            )
            user = cursor.fetchone()
            cursor.close()
            
            if user and bcrypt.checkpw(password.encode('utf-8'), user[3].encode('utf-8')):
                return {
                    'id': user[0],
                    'name': user[1],
                    'email': user[2]
                }
            return None
        except Exception as e:
            print(f"Error authenticating user: {e}")
            return None

    @staticmethod
    def get_user_by_id(user_id):
        try:
            conn = mysql.connection
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, name, email FROM users WHERE id = %s",
                (user_id,)
            )
            user = cursor.fetchone()
            cursor.close()
            
            if user:
                return {
                    'id': user[0],
                    'name': user[1],
                    'email': user[2]
                }
            return None
        except Exception as e:
            print(f"Error getting user: {e}")
            return None

    @staticmethod
    def generate_token(user_id):
        try:
            payload = {
                'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1),
                'iat': datetime.datetime.utcnow(),
                'sub': user_id
            }
            return jwt.encode(payload, Config.SECRET_KEY, algorithm='HS256')
        except Exception as e:
            print(f"Error generating token: {e}")
            return None

    @staticmethod
    def verify_token(token):
        try:
            payload = jwt.decode(token, Config.SECRET_KEY, algorithms=['HS256'])
            return payload['sub']
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None