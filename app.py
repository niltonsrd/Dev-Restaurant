# app.py (revisado e pronto para Render + MySQL + vendas + notas PDF)
import os
import decimal
import traceback
from datetime import datetime, timezone

from flask import (
    Flask, render_template, g, jsonify,
    request, redirect, url_for, flash, send_from_directory, abort
)
from werkzeug.utils import secure_filename

# MySQL
import mysql.connector
from mysql.connector import errorcode

# PDF
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib import colors
from reportlab.lib.units import mm

# -----------------------------------
# CONFIGURAÇÕES DO SISTEMA
# -----------------------------------

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

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
app.config['PROPAGATE_EXCEPTIONS'] = True
app.secret_key = os.environ.get('FLASK_SECRET', 'dev-secret')
app.config['UPLOAD_FOLDER_PRODUCTS'] = UPLOAD_FOLDER_PRODUCTS
app.config['UPLOAD_FOLDER_PIX'] = UPLOAD_FOLDER_PIX
app.config['NOTAS_FOLDER'] = NOTAS_FOLDER

# -----------------------------------
# CONFIGURAÇÃO DO MYSQL
# -----------------------------------

MYSQL_CONFIG = {
    'host': os.getenv("MYSQL_HOST"),
    'user': os.getenv("MYSQL_USER"),
    'password': os.getenv("MYSQL_PASSWORD"),
    'database': os.getenv("MYSQL_DB"),
    'port': int(os.getenv("MYSQL_PORT", 3306))
}

# Checagem obrigatória
for key in ["MYSQL_HOST", "MYSQL_USER", "MYSQL_PASSWORD", "MYSQL_DB"]:
    if not os.getenv(key):
        raise RuntimeError(f"Variável de ambiente {key} não definida")

# -----------------------------------
# BANCO DE DADOS
# -----------------------------------

def get_db():
    if '_database' not in g:
        try:
            conn = mysql.connector.connect(
                host=MYSQL_CONFIG['host'],
                user=MYSQL_CONFIG['user'],
                password=MYSQL_CONFIG['password'],
                database=MYSQL_CONFIG['database'],
                port=MYSQL_CONFIG['port'],
            )
            conn.autocommit = False
            g._database = conn
        except mysql.connector.Error as err:
            if getattr(err, 'errno', None) == errorcode.ER_ACCESS_DENIED_ERROR:
                raise RuntimeError("Erro MySQL: usuário/senha incorretos")
            elif getattr(err, 'errno', None) == errorcode.ER_BAD_DB_ERROR:
                raise RuntimeError("Erro MySQL: banco de dados não existe")
            else:
                raise
    return g._database

@app.teardown_appcontext
def close_connection(exception):
    db = g.pop('_database', None)
    if db is not None:
        try:
            db.close()
        except Exception:
            pass

# -----------------------------------
# HELPERS
# -----------------------------------

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def save_pix_file(file_storage):
    if not file_storage:
        return None
    filename = secure_filename(file_storage.filename)
    if filename == '':
        return None
    if not allowed_file(filename):
        return None
    name, ext = os.path.splitext(filename)
    ts = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')
    final = f"{name}_{ts}{ext}"
    dest = os.path.join(app.config['UPLOAD_FOLDER_PIX'], final)
    file_storage.save(dest)
    return final

def build_public_pix_url(filename):
    if not filename:
        return None
    base = SERVER_URL.rstrip('/') if SERVER_URL else request.host_url.rstrip('/')
    return f"{base}/pix/{filename}"

def ensure_schema():
    db = get_db()
    cursor = db.cursor()
    # produtos
    try:
        cursor.execute("DESCRIBE produtos")
        cols = [r[0] for r in cursor.fetchall()]
        if 'image' not in cols:
            cursor.execute("ALTER TABLE produtos ADD COLUMN image VARCHAR(255) DEFAULT NULL")
        if 'description' not in cols and 'descricao' not in cols:
            cursor.execute("ALTER TABLE produtos ADD COLUMN description TEXT DEFAULT NULL")
    except Exception:
        pass
    # pedidos
    try:
        cursor.execute("DESCRIBE pedidos")
        cols = [r[0] for r in cursor.fetchall()]
        if 'telefone' not in cols:
            cursor.execute("ALTER TABLE pedidos ADD COLUMN telefone VARCHAR(30) DEFAULT NULL")
        if 'forma_pagamento' not in cols:
            cursor.execute("ALTER TABLE pedidos ADD COLUMN forma_pagamento VARCHAR(50) DEFAULT NULL")
        if 'status' not in cols:
            cursor.execute("ALTER TABLE pedidos ADD COLUMN status VARCHAR(20) DEFAULT 'pendente'")
        if 'observacoes' not in cols:
            cursor.execute("ALTER TABLE pedidos ADD COLUMN observacoes TEXT DEFAULT NULL")
        if 'delivery_fee' not in cols:
            cursor.execute("ALTER TABLE pedidos ADD COLUMN delivery_fee DECIMAL(10,2) DEFAULT 0.00")
        db.commit()
    except Exception:
        pass
    cursor.close()

def _ensure_schema_on_start():
    try:
        ensure_schema()
    except Exception:
        print("Warning: falha ao tentar ajustar schema automaticamente.")

# -----------------------------------
# ROTAS PÚBLICAS
# -----------------------------------

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/products')
def api_products():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id, nome AS name, preco AS price, categoria AS category, image, description FROM produtos ORDER BY categoria, nome")
    rows = cursor.fetchall()
    cursor.close()
    normalized = []
    for r in rows:
        if isinstance(r.get('price'), decimal.Decimal):
            r['price'] = float(r['price'])
        normalized.append(r)
    return jsonify(normalized)

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
    import json
    data = request.form
    customer_name = data.get('customer_name') or data.get('customerName') or data.get('name') or ''
    customer_address = data.get('customer_address') or data.get('customerAddress') or data.get('address') or ''
    customer_contact = data.get('customer_contact') or data.get('customerContact') or ''
    customer_note = data.get('customer_note') or data.get('customerNote') or ''
    customer_bairro = (data.get('customer_bairro') or data.get('customerBairro') or data.get('bairro') or '').strip()
    payment_method = (data.get('payment_method') or data.get('paymentMethod') or '').strip()
    troco_para = (data.get('troco_para') or data.get('trocoPara') or '').strip()
    cart_json = data.get('cart') or data.get('cart_json') or data.get('carrinho') or '[]'
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
        'Zona Sul': 12.00,
        'Outro': 10.00
    }
    delivery_fee = TAXAS.get(customer_bairro, TAXAS['Outro'])
    delivery_override = data.get('delivery_tax') or data.get('deliveryTax')
    if delivery_override:
        try:
            delivery_fee = float(delivery_override)
        except ValueError:
            pass

    # Comprovante PIX
    pix_filename = None
    pix_url = None
    if (payment_method or '').lower() == "pix" and 'pix_comprovante' in request.files:
        file = request.files['pix_comprovante']
        saved = save_pix_file(file)
        if saved:
            pix_filename = saved
            pix_url = build_public_pix_url(saved)
        else:
            return jsonify({'ok': False, 'error': 'Arquivo do comprovante inválido.'}), 400

    # Mensagem WhatsApp
    lines = []
    lines.append("🧾 *Pedido - Dev Restaurante*")
    lines.append(f"👤 Cliente: {customer_name}")
    lines.append(f"📍 Endereço: {customer_address}")
    lines.append(f"🏙 Bairro: {customer_bairro or '—'}")
    if customer_contact:
        lines.append(f"📞 Contato: {customer_contact}")
    if customer_note:
        lines.append(f"📝 Obs: {customer_note}")
    lines.append("")
    lines.append(f"💳 *Pagamento:* {payment_method or '—'}")

    if payment_method.lower() == "dinheiro" and troco_para:
        raw = ''.join(ch for ch in troco_para if (ch.isdigit() or ch in ',.'))
        raw = raw.replace(',', '.')
        try:
            troco_val = float(raw)
            lines.append(f"Troco para: R$ {troco_val:.2f}")
        except Exception:
            lines.append(f"Troco para: {troco_para}")

    if payment_method.lower() == "pix":
        lines.append("💠 PIX enviado ✔")

    lines.append("")
    lines.append("🍔 *Itens:*")
    total_items = 0.0
    for it in cart:
        name = it.get('name') or it.get('nome') or 'Item'
        qty = int(it.get('qty') or it.get('qtd') or it.get('quantity') or 1)
        price = float(it.get('price') or it.get('preco') or 0.0)
        subtotal = qty * price
        total_items += subtotal
        lines.append(f"- {qty}x {name} — R$ {subtotal:.2f}")

    lines.append("")
    lines.append(f"🚚 Entrega: R$ {delivery_fee:.2f}")
    total_final = total_items + delivery_fee
    lines.append(f"💰 *Total:* R$ {total_final:.2f}")
    if pix_url:
        lines.append("")
        lines.append(f"📎 Comprovante PIX: {pix_url}")
    lines.append("")
    lines.append("📨 Pedido enviado via site Dev Restaurante.")

    text = "%0A".join(lines)
    whatsapp_url = f"https://api.whatsapp.com/send?phone={RESTAURANT_PHONE}&text={text}"

    # ---------- SALVAR NO BANCO ----------
    db = None
    try:
        db = get_db()
        cursor = db.cursor()
        insert_pedido = ("INSERT INTO pedidos "
"(nome_cliente, endereco, bairro, total, data, telefone, forma_pagamento, status, observacoes, delivery_fee) "
"VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)")
        now = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute(insert_pedido, (
            customer_name,
            customer_address,
            customer_bairro,
            f"{total_final:.2f}",
            now,
            customer_contact,
            payment_method,
            'pendente',
            customer_note,
            f"{delivery_fee:.2f}"
        ))
        pedido_id = cursor.lastrowid if hasattr(cursor, 'lastrowid') else None

        insert_item = ("INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario) "
                       "VALUES (%s, %s, %s, %s)")
        for it in cart:
            try:
                produto_id = int(it.get('id') or it.get('product_id') or it.get('produto_id') or 0)
            except Exception:
                produto_id = 0
            qty = int(it.get('qty') or it.get('qtd') or it.get('quantity') or 1)
            price = float(it.get('price') or it.get('preco') or 0.0)
            cursor.execute(insert_item, (pedido_id, produto_id, qty, f"{price:.2f}"))

        db.commit()
        cursor.close()
    except Exception as e:
        print("\n===== ERRO NO CHECKOUT =====")
        traceback.print_exc()
        print("============================\n")
        try:
            if db is not None:
                db.rollback()
        except Exception:
            pass
        return jsonify({'ok': False, 'error': f'Erro ao salvar pedido: {str(e)}'}), 500

    return jsonify({
        'ok': True,
        'whatsapp_url': whatsapp_url,
        'pix_file': pix_filename,
        'pix_url': pix_url,
        'pedido_id': pedido_id,
        'total': f"{total_final:.2f}"
    })

# DOWNLOAD PIX
@app.route('/pix/<filename>')
def get_pix_file(filename):
    return send_from_directory(UPLOAD_FOLDER_PIX, filename)

# -----------------------------------
# ROTAS ADMIN
# -----------------------------------

@app.route('/admin', methods=['GET', 'POST'])
def admin():
    if request.method == 'POST':
        password = request.form.get('password', '')
        if password == ADMIN_PASSWORD:
            response = redirect(url_for('admin'))
            response.set_cookie('admin_auth', '1', max_age=3600, httponly=True, samesite='Lax', path='/', secure=False)
            return response
        flash("Senha incorreta", "error")
        return redirect(url_for('admin'))

    is_admin = request.cookies.get('admin_auth') == '1'
    if not is_admin:
        return render_template("login_admin.html")

    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id, nome, preco, categoria, image, description FROM produtos ORDER BY id")
    prods = cursor.fetchall()
    cursor.close()

    products = []
    for p in prods:
        products.append({
            'id': p.get('id'),
            'name': p.get('nome'),
            'price': float(p.get('preco') or 0.0),
            'category': p.get('categoria'),
            'image': p.get('image') or '',
            'description': p.get('description') or ''
        })

    return render_template("admin.html", admin=True, products=products)

@app.route('/admin/logout', methods=['GET', 'POST'])
def admin_logout():
    response = redirect(url_for('index'))
    response.set_cookie('admin_auth', '', expires=0, path='/')
    return response

# ROTAS CRUD PRODUTOS
@app.route('/admin/add', methods=['POST'])
def admin_add():
    if request.cookies.get('admin_auth') != '1':
        flash("Acesso negado", "error")
        return redirect(url_for('admin'))

    nome = request.form.get('name')
    preco = request.form.get('price')
    categoria = request.form.get('category')
    description = request.form.get('description')

    file = request.files.get('image')
    filename = None
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        name_only, ext = os.path.splitext(filename)
        ts = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')
        filename = f"{name_only}_{ts}{ext}"
        file.save(os.path.join(UPLOAD_FOLDER_PRODUCTS, filename))

    db = get_db()
    cursor = db.cursor()
    cursor.execute(
        "INSERT INTO produtos (nome, preco, categoria, image, description) VALUES (%s, %s, %s, %s, %s)",
        (nome, preco, categoria, filename, description)
    )
    db.commit()
    cursor.close()
    flash("Produto adicionado!", "success")
    return redirect(url_for('admin'))

@app.route('/admin/delete/<int:id>', methods=['POST'])
def admin_delete(id):
    if request.cookies.get('admin_auth') != '1':
        flash("Acesso negado", "error")
        return redirect(url_for('admin'))
    db = get_db()
    cursor = db.cursor()
    cursor.execute("DELETE FROM produtos WHERE id=%s", (id,))
    db.commit()
    cursor.close()
    flash("Produto removido.", "success")
    return redirect(url_for('admin'))

@app.route('/admin/edit/<int:id>', methods=['POST'])
def admin_edit(id):
    if request.cookies.get('admin_auth') != '1':
        flash("Acesso negado", "error")
        return redirect(url_for('admin'))

    nome = request.form.get('name')
    preco = request.form.get('price')
    categoria = request.form.get('category')
    description = request.form.get('description')

    file = request.files.get('image')
    filename = None
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        name_only, ext = os.path.splitext(filename)
        ts = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')
        filename = f"{name_only}_{ts}{ext}"
        file.save(os