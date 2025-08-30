import os
import logging
import requests
import json
from flask import render_template, request, jsonify, flash
from app import app, db
from models import Order

# AbacatePay API configuration
ABACATEPAY_API_KEY = os.environ.get("ABACATEPAY_API_KEY")
ABACATEPAY_BASE_URL = "https://api.abacatepay.com/v1"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/create-payment', methods=['POST'])
def create_payment():
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'phone', 'email', 'cpf']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} é obrigatório'}), 400
        
        # Validate API key
        if not ABACATEPAY_API_KEY:
            logging.error("ABACATEPAY_API_KEY not configured")
            return jsonify({
                'error': 'Configuração de pagamento não encontrada. Contate o suporte.'
            }), 500
        
        # Create order record
        order = Order(
            name=data['name'],
            phone=data['phone'],
            email=data['email'],
            cpf=data['cpf'],
            amount=1990  # R$19,90 em centavos
        )
        
        db.session.add(order)
        db.session.commit()
        
        # Create PIX QR Code with AbacatePay
        payment_data = {
            "amount": 1990,  # R$19,90 em centavos
            "expiresIn": 3600,  # 1 hora
            "description": "BeautyStories - Pacote de Figurinhas",
            "customer": {
                "name": data['name'],
                "cellphone": data['phone'],
                "email": data['email'],
                "taxId": data['cpf']
            },
            "metadata": {
                "order_id": str(order.id),
                "product": "BeautyStories"
            }
        }
        
        headers = {
            "Authorization": f"Bearer {ABACATEPAY_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        logging.info(f"Creating PIX QR Code for order {order.id} - Amount: R${payment_data['amount']/100:.2f}")
        
        response = requests.post(
            f"{ABACATEPAY_BASE_URL}/pixQrCode/create",
            json=payment_data,
            headers=headers,
            timeout=30
        )
        
        if response.status_code == 200 or response.status_code == 201:
            response_data = response.json()
            
            if response_data.get('error'):
                logging.error(f"AbacatePay API error: {response_data['error']}")
                return jsonify({
                    'error': 'Erro ao processar pagamento. Tente novamente.'
                }), 500
            
            payment_info = response_data.get('data')
            if not payment_info:
                logging.error(f"Invalid response structure: {response_data}")
                return jsonify({
                    'error': 'Resposta inválida da API. Tente novamente.'
                }), 500
            
            # Update order with payment ID and expiration
            order.payment_id = payment_info.get('id')
            order.status = 'pending'
            
            # Parse expiration date if provided
            expires_at = payment_info.get('expiresAt')
            if expires_at:
                try:
                    from dateutil import parser
                    order.expires_at = parser.parse(expires_at)
                except:
                    pass  # Continue without expires_at if parsing fails
            
            db.session.commit()
            
            return jsonify({
                'success': True,
                'qr_code': payment_info.get('brCode'),
                'qr_code_base64': payment_info.get('brCodeBase64'),
                'payment_id': payment_info.get('id'),
                'order_id': order.id,
                'expires_at': payment_info.get('expiresAt'),
                'amount': payment_info.get('amount')
            })
        else:
            logging.error(f"AbacatePay API error: {response.status_code} - {response.text}")
            return jsonify({
                'error': 'Erro ao processar pagamento. Tente novamente.'
            }), 500
            
    except requests.RequestException as e:
        logging.error(f"Request error: {str(e)}")
        return jsonify({
            'error': 'Erro de conexão. Verifique sua internet e tente novamente.'
        }), 500
    except Exception as e:
        logging.error(f"Unexpected error: {str(e)}")
        db.session.rollback()
        return jsonify({
            'error': 'Erro interno. Tente novamente.'
        }), 500

@app.route('/api/webhook/payment', methods=['POST'])
def payment_webhook():
    try:
        data = request.get_json()
        logging.debug(f"Received webhook: {data}")
        
        # Verify webhook authenticity (implement signature verification as per AbacatePay docs)
        external_id = data.get('external_id')
        status = data.get('status')
        
        if external_id and status:
            order = Order.query.get(external_id)
            if order:
                order.status = status
                db.session.commit()
                logging.info(f"Order {external_id} status updated to {status}")
        
        return jsonify({'status': 'ok'})
        
    except Exception as e:
        logging.error(f"Webhook error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/payment-status/<int:order_id>')
def payment_status(order_id):
    try:
        order = Order.query.get_or_404(order_id)
        
        # Se não temos payment_id, retorna o status atual do banco
        if not order.payment_id:
            return jsonify({
                'status': order.status,
                'order_id': order.id
            })
        
        # Consulta o status na AbacatePay
        if ABACATEPAY_API_KEY:
            headers = {
                "Authorization": f"Bearer {ABACATEPAY_API_KEY}",
                "Accept": "application/json"
            }
            
            try:
                response = requests.get(
                    f"{ABACATEPAY_BASE_URL}/pixQrCode/check",
                    params={'id': order.payment_id},
                    headers=headers,
                    timeout=15
                )
                
                if response.status_code == 200:
                    response_data = response.json()
                    if response_data.get('data'):
                        api_status = response_data['data'].get('status', '').lower()
                        
                        # Mapear status da API para nosso sistema
                        status_mapping = {
                            'pending': 'pending',
                            'paid': 'paid',
                            'expired': 'expired',
                            'cancelled': 'cancelled'
                        }
                        
                        mapped_status = status_mapping.get(api_status, order.status)
                        
                        # Atualiza status no banco se mudou
                        if mapped_status != order.status:
                            order.status = mapped_status
                            db.session.commit()
                            logging.info(f"Order {order_id} status updated to {mapped_status}")
                        
                        return jsonify({
                            'status': mapped_status,
                            'order_id': order.id,
                            'expires_at': response_data['data'].get('expiresAt')
                        })
                    
            except requests.RequestException as e:
                logging.error(f"Error checking payment status: {str(e)}")
        
        # Fallback para status do banco
        return jsonify({
            'status': order.status,
            'order_id': order.id
        })
        
    except Exception as e:
        logging.error(f"Status check error: {str(e)}")
        return jsonify({'error': 'Order not found'}), 404

@app.route('/success')
def success():
    return render_template('index.html')

@app.route('/api/simulate-payment/<int:order_id>', methods=['POST'])
def simulate_payment(order_id):
    """Endpoint para simular pagamento durante desenvolvimento (Dev Mode)"""
    try:
        order = Order.query.get_or_404(order_id)
        
        if not order.payment_id:
            return jsonify({'error': 'Pedido não possui ID de pagamento'}), 400
        
        if not ABACATEPAY_API_KEY:
            return jsonify({'error': 'API key não configurada'}), 500
        
        headers = {
            "Authorization": f"Bearer {ABACATEPAY_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        # Simular pagamento na AbacatePay (Dev Mode)
        response = requests.post(
            f"{ABACATEPAY_BASE_URL}/pixQrCode/simulate-payment",
            params={'id': order.payment_id},
            json={'metadata': {}},
            headers=headers,
            timeout=15
        )
        
        if response.status_code == 200:
            response_data = response.json()
            if response_data.get('data'):
                payment_info = response_data['data']
                api_status = payment_info.get('status', '').lower()
                
                if api_status == 'paid':
                    order.status = 'paid'
                    db.session.commit()
                    logging.info(f"Order {order_id} payment simulated successfully")
                    
                    return jsonify({
                        'success': True,
                        'status': 'paid',
                        'order_id': order.id,
                        'message': 'Pagamento simulado com sucesso!'
                    })
        
        logging.error(f"Failed to simulate payment: {response.status_code} - {response.text}")
        return jsonify({
            'error': 'Erro ao simular pagamento. Certifique-se de estar em Dev Mode.'
        }), 500
        
    except Exception as e:
        logging.error(f"Simulate payment error: {str(e)}")
        return jsonify({'error': 'Erro interno'}), 500
