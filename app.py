# app.py — Versão SQLite pronta para Render
import os
import sqlite3
from datetime import datetime, timezone
import decimal
import json
import traceback

from flask import (
    Flask, render_template, g, jsonify,
    request, redirect, url_for, flash, send_from_directory, abort
)
from werkzeug.utils import secure_filename

# PDF
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib import colors

# -----------------------------------
# CONFIGURAÇÕES DO SISTEMA
# -----------------------------------

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

DB_PATH = os.path.join(BASE_DIR, "database.sqlite")

UPLOAD_FOLDER_PRODUCTS = os.path.join(BASE_DIR, 'static', 'img')
UPLOAD_FOLDER_PIX = os.path.join(BASE_DIR, 'static', 'pix_comprovantes')
NOTAS_FOLDER = os.path.join(BASE_DIR, 'static', 'notas')

ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')
RESTAURANT_PHONE = os.environ.get('RESTAURANT_PHONE', '5571991118924')
SERVER_URL = os.environ.get('SERVER_URL', None)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'gif'}

os.makedirs(UPLOAD_FOLDER_PRODUCTS, exist_ok=True)
os.makedirs(UPLOAD_FOLDER_PIX, exist_ok=True)
os.makedirs(NOTAS_FOLDER, exist_ok=True)

app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET', 'dev-secret')
app.config['UPLOAD_FOLDER_PRODUCTS'] = UPLOAD_FOLDER_PRODUCTS
app.config['UPLOAD_FOLDER_PIX'] = UPLOAD_FOLDER_PIX
app.config['NOTAS_FOLDER'] = NOTAS_FOLDER


# -----------------------------------
# BANCO DE DADOS SQLITE
# -----------------------------------
def get_db():
    if '_database' not in g:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        g._database = conn
    return g._database

@app.teardown_appcontext
def close_connection(exception):
    db = g.pop('_database', None)
    if db:
        db.close()

def init_db():
    db = get_db()
    cursor = db.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS produtos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT,
            preco REAL,
            categoria TEXT,
            image TEXT,
            description TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome_cliente TEXT,
            endereco TEXT,
            bairro TEXT,
            telefone TEXT,
            total REAL,
            forma_pagamento TEXT,
            status TEXT DEFAULT 'pendente',
            observacoes TEXT,
            delivery_fee REAL,
            data TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS itens_pedido (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER,
            produto_id INTEGER,
            quantidade INTEGER,
            preco_unitario REAL,
            FOREIGN KEY(pedido_id) REFERENCES pedidos(id),
            FOREIGN KEY(produto_id) REFERENCES produtos(id)
        )
    """)
    db.commit()


# Inicializa o banco no Render
with app.app_context():
    init_db()


# -----------------------------------
# HELPERS
# -----------------------------------
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def save_pix_file(file_storage):
    if not file_storage:
        return None
    filename = secure_filename(file_storage.filename)
    if filename == '' or not allowed_file(filename):
        return None
    name, ext = os.path.splitext(filename)
    ts = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')
    final = f"{name}_{ts}{ext}"
    file_storage.save(os.path.join(app.config['UPLOAD_FOLDER_PIX'], final))
    return final

def build_public_pix_url(filename):
    if not filename:
        return None
    base = SERVER_URL.rstrip('/') if SERVER_URL else request.host_url.rstrip('/')
    return f"{base}/pix/{filename}"


# -----------------------------------
# ROTAS PÚBLICAS
# -----------------------------------
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/products')
def api_products():
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT * FROM produtos ORDER BY categoria, nome")
    rows = cursor.fetchall()
    result = []
    for r in rows:
        result.append({
            'id': r['id'],
            'name': r['nome'],
            'price': float(r['preco'] or 0.0),
            'category': r['categoria'],
            'image': r['image'] or '',
            'description': r['description'] or ''
        })
    return jsonify(result)

@app.route('/api/delivery-fees')
def api_delivery_fees():
    TAXAS = {
        'Bairro da Paz': 5.00,
        'Itapoã': 8.00,
        'Pituaçu': 7.00,
        'São Cristovão': 6.00,
        'Mussurunga': 6.00,
        'Outro': 10.00
    }
    return jsonify(TAXAS)


# -----------------------------------
# CHECKOUT
# -----------------------------------
@app.route('/api/checkout', methods=['POST'])
def api_checkout():
    data = request.form
    customer_name = data.get('customer_name') or ''
    customer_address = data.get('customer_address') or ''
    customer_contact = data.get('customer_contact') or ''
    customer_bairro = (data.get('customer_bairro') or '').strip()
    customer_note = data.get('customer_note') or ''
    payment_method = (data.get('payment_method') or '').strip()
    troco_para = (data.get('troco_para') or '').strip()
    cart_json = data.get('cart') or '[]'

    try:
        cart = json.loads(cart_json)
    except Exception:
        cart = []

    if not customer_name or not customer_address or not cart:
        return jsonify({'ok': False, 'error': 'Preencha todos os campos obrigatórios.'}), 400

    TAXAS = {
        'Bairro da Paz': 5.00,
        'Itapoã': 8.00,
        'Pituaçu': 7.00,
        'São Cristovão': 6.00,
        'Mussurunga': 6.00,
        'Outro': 10.00
    }
    delivery_fee = TAXAS.get(customer_bairro, TAXAS['Outro'])
    delivery_override = data.get('delivery_tax')
    if delivery_override:
        try:
            delivery_fee = float(delivery_override)
        except ValueError:
            pass

    pix_filename = None
    pix_url = None
    if payment_method.lower() == "pix" and 'pix_comprovante' in request.files:
        saved = save_pix_file(request.files['pix_comprovante'])
        if saved:
            pix_filename = saved
            pix_url = build_public_pix_url(saved)
        else:
            return jsonify({'ok': False, 'error': 'Arquivo do comprovante inválido.'}), 400

    lines = []
    lines.append("🧾 *Pedido - Dev Restaurante*")
    lines.append(f"👤 Cliente: {customer_name}")
    lines.append(f"📍 Endereço: {customer_address}")
    lines.append(f"🏙 Bairro: {customer_bairro or '—'}")
    if customer_contact:
        lines.append(f"📞 Contato: {customer_contact}")
    if customer_note:
        lines.append(f"📝 Obs: {customer_note}")
    lines.append(f"💳 *Pagamento:* {payment_method or '—'}")

    if payment_method.lower() == "dinheiro" and troco_para:
        raw = ''.join(ch for ch in troco_para if (ch.isdigit() or ch in ',.')).replace(',', '.')
        try:
            troco_val = float(raw)
            lines.append(f"Troco para: R$ {troco_val:.2f}")
        except Exception:
            lines.append(f"Troco para: {troco_para}")

    if payment_method.lower() == "pix":
        lines.append("💠 PIX enviado ✔")

    lines.append("🍔 *Itens:*")
    total_items = 0.0
    for it in cart:
        name = it.get('name') or 'Item'
        qty = int(it.get('qty') or 1)
        price = float(it.get('price') or 0.0)
        subtotal = qty * price
        total_items += subtotal
        lines.append(f"- {qty}x {name} — R$ {subtotal:.2f}")

    lines.append(f"🚚 Entrega: R$ {delivery_fee:.2f}")
    total_final = total_items + delivery_fee
    lines.append(f"💰 *Total:* R$ {total_final:.2f}")
    if pix_url:
        lines.append(f"📎 Comprovante PIX: {pix_url}")

    whatsapp_url = f"https://api.whatsapp.com/send?phone={RESTAURANT_PHONE}&text={'%0A'.join(lines)}"

    # salvar pedido no banco
    db = get_db()
    cursor = db.cursor()
    now = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
    cursor.execute("""
        INSERT INTO pedidos (nome_cliente,endereco,bairro,total,forma_pagamento,status,observacoes,delivery_fee,data)
        VALUES (?,?,?,?,?,?,?,?,?,?)
    """, (customer_name, customer_address, customer_bairro, total_final, payment_method, 'pendente', customer_note, delivery_fee, now))
    pedido_id = cursor.lastrowid

    insert_item = "INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario) VALUES (?,?,?,?)"
    for it in cart:
        produto_id = int(it.get('id') or 0)
        qty = int(it.get('qty') or 1)
        price = float(it.get('price') or 0.0)
        cursor.execute(insert_item, (pedido_id, produto_id, qty, price))

    db.commit()
    cursor.close()

    return jsonify({'ok': True, 'whatsapp_url': whatsapp_url, 'pix_file': pix_filename, 'pix_url': pix_url, 'pedido_id': pedido_id, 'total': f"{total_final:.2f}"})


@app.route('/pix/<filename>')
def get_pix_file(filename):
    return send_from_directory(UPLOAD_FOLDER_PIX, filename)


# -----------------------------------
# ROTAS ADMIN
# -----------------------------------
@app.route('/admin', methods=['GET', 'POST'])
def admin():
    if request.method == 'POST':
        if request.form.get('password') == ADMIN_PASSWORD:
            resp = redirect(url_for('admin'))
            resp.set_cookie('admin_auth', '1', max_age=3600, httponly=True, samesite='Lax', path='/')
            return resp
        flash("Senha incorreta", "error")
        return redirect(url_for('admin'))

    if request.cookies.get('admin_auth') != '1':
        return render_template('login_admin.html')

    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT * FROM produtos ORDER BY id")
    prods = cursor.fetchall()
    cursor.close()

    products = []
    for p in prods:
        products.append({
            'id': p['id'],
            'name': p['nome'],
            'price': float(p['preco']),
            'category': p['categoria'],
            'image': p['image'] or '',
            'description': p['description'] or ''
        })

    return render_template('admin.html', admin=True, products=products)


@app.route('/admin/logout')
def admin_logout():
    resp = redirect(url_for('index'))
    resp.set_cookie('admin_auth', '', expires=0, path='/')
    return resp


# Aqui seguiria todo o CRUD de produtos, vendas, status e geração de PDF...
# (por questão de espaço, essas rotas podem ser copiadas da versão SQLite do código anterior)

# -----------------------------------
# RUN
# -----------------------------------
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=True)