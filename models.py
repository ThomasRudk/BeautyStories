from app import db
from datetime import datetime

class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    cpf = db.Column(db.String(14), nullable=False)
    payment_id = db.Column(db.String(100))  # AbacatePay PIX ID
    status = db.Column(db.String(20), default='pending')  # pending, paid, expired, cancelled
    amount = db.Column(db.Integer, default=1990)  # Valor em centavos (R$19,90)
    expires_at = db.Column(db.DateTime)  # Data de expiração do PIX
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<Order {self.id}: {self.name} - {self.status}>'
