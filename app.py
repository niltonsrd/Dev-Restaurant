# app.py - Sistema completo SQLite

import os
import sqlite3
import decimal
import json
from datetime import datetime, timezone
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
from reportlab.lib.units import mm

# ------------------------------
# CONFIGURAÇÕES
# ------------------------------

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, "database.db")

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

# ------------------------------
# BANCO DE DADOS (SQLite)
# ------------------------------

def get_db():
    if '_database' not in g:
        g._database = sqlite3.connect(DB_PATH)
        g._database.row_factory = sqlite3.Row
    return g._database

@app.teardown_appcontext
def close_connection(exception):
    db = g.pop('_database', None)
    if db:
        db.close()

def init_db():
    db = get_db()
    cursor = db.cursor()
    # Tabela produtos
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS produtos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            preco REAL NOT NULL,
            categoria TEXT DEFAULT '',
            image TEXT DEFAULT NULL,
            description TEXT DEFAULT NULL
        )
    """)
    # Tabela pedidos
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome_cliente TEXT NOT NULL,
            endereco TEXT NOT NULL,
            bairro TEXT,
            total REAL NOT NULL,
            data TEXT NOT NULL,
            telefone TEXT,
            forma_pagamento TEXT,
            status TEXT DEFAULT 'pendente',
            observacoes TEXT,
            delivery_fee REAL DEFAULT 0.0
        )
    """)
    # Tabela itens_pedido
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS itens_pedido (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER NOT NULL,
            produto_id INTEGER NOT NULL,
            quantidade INTEGER NOT NULL,
            preco_unitario REAL NOT NULL,
            FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
            FOREIGN KEY (produto_id) REFERENCES produtos(id)
        )
    """)
    db.commit()
    cursor.close()

# ------------------------------
# HELPERS
# ------------------------------

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

# ------------------------------
# ROTAS PÚBLICAS
# ------------------------------

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/products')
def api_products():
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT * FROM produtos ORDER BY categoria, nome")
    rows = cursor.fetchall()
    products = []
    for r in rows:
        products.append({
            'id': r['id'],
            'name': r['nome'],
            'price': float(r['preco']),
            'category': r['categoria'],
            'image': r['image'],
            'description': r['description']
        })
    return jsonify(products)

# ------------------------------
# CHECKOUT
# ------------------------------

@app.route('/api/checkout', methods=['POST'])
def api_checkout():
    data = request.form
    customer_name = data.get('customer_name', '')
    customer_address = data.get('customer_address', '')
    customer_contact = data.get('customer_contact', '')
    customer_note = data.get('customer_note', '')
    customer_bairro = data.get('customer_bairro', '')
    payment_method = data.get('payment_method', '')
    troco_para = data.get('troco_para', '')
    cart_json = data.get('cart', '[]')
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

    # Comprovante PIX
    pix_filename = None
    pix_url = None
    if payment_method.lower() == "pix" and 'pix_comprovante' in request.files:
        file = request.files['pix_comprovante']
        saved = save_pix_file(file)
        if saved:
            pix_filename = saved
            pix_url = build_public_pix_url(saved)
        else:
            return jsonify({'ok': False, 'error': 'Arquivo do comprovante inválido.'}), 400

    # Calcular total dos itens
    total_items = sum([float(i.get('price', 0)) * int(i.get('qty', 1)) for i in cart])
    total_final = total_items + delivery_fee

    # Salvar pedido
    db = get_db()
    cursor = db.cursor()
    now = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
    cursor.execute("""
        INSERT INTO pedidos
        (nome_cliente, endereco, bairro, total, data, telefone, forma_pagamento, status, observacoes, delivery_fee)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        customer_name, customer_address, customer_bairro, total_final, now,
        customer_contact, payment_method, 'pendente', customer_note, delivery_fee
    ))
    pedido_id = cursor.lastrowid

    # Salvar itens
    for it in cart:
        produto_id = int(it.get('id', 0))
        qty = int(it.get('qty', 1))
        price = float(it.get('price', 0))
        cursor.execute("""
            INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario)
            VALUES (?, ?, ?, ?)
        """, (pedido_id, produto_id, qty, price))
    db.commit()
    cursor.close()

    # Montar mensagem WhatsApp
    lines = [
        f"🧾 Pedido - Dev Restaurante",
        f"👤 Cliente: {customer_name}",
        f"📍 Endereço: {customer_address}",
        f"🏙 Bairro: {customer_bairro or '—'}",
        f"📞 Contato: {customer_contact}",
        f"📝 Obs: {customer_note}",
        "",
        f"💳 Pagamento: {payment_method or '—'}",
        "",
        "🍔 Itens:"
    ]
    for it in cart:
        name = it.get('name', 'Item')
        qty = int(it.get('qty', 1))
        price = float(it.get('price', 0))
        lines.append(f"- {qty}x {name} — R$ {qty*price:.2f}")
    lines.append(f"🚚 Entrega: R$ {delivery_fee:.2f}")
    lines.append(f"💰 Total: R$ {total_final:.2f}")
    if pix_url:
        lines.append(f"📎 Comprovante PIX: {pix_url}")
    lines.append("")
    lines.append("📨 Pedido enviado via site Dev Restaurante.")

    whatsapp_url = f"https://api.whatsapp.com/send?phone={RESTAURANT_PHONE}&text={'%0A'.join(lines)}"

    # Gerar PDF automaticamente
    gerar_nota_pdf(pedido_id)

    return jsonify({
        'ok': True,
        'whatsapp_url': whatsapp_url,
        'pix_file': pix_filename,
        'pix_url': pix_url,
        'pedido_id': pedido_id,
        'total': f"{total_final:.2f}"
    })

@app.route('/pix/<filename>')
def get_pix_file(filename):
    return send_from_directory(UPLOAD_FOLDER_PIX, filename)

# ------------------------------
# ROTAS ADMIN
# ------------------------------

@app.route('/admin', methods=['GET', 'POST'])
def admin():
    if request.method == 'POST':
        password = request.form.get('password', '')
        if password == ADMIN_PASSWORD:
            response = redirect(url_for('admin'))
            response.set_cookie('admin_auth', '1', max_age=3600, httponly=True, samesite='Lax')
            return response
        flash("Senha incorreta", "error")
        return redirect(url_for('admin'))

    is_admin = request.cookies.get('admin_auth') == '1'
    if not is_admin:
        return render_template("login_admin.html")

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
    return render_template("admin.html", admin=True, products=products)

@app.route('/admin/logout')
def admin_logout():
    response = redirect(url_for('index'))
    response.set_cookie('admin_auth', '', expires=0)
    return response

# CRUD Produtos
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
    cursor.execute("INSERT INTO produtos (nome, preco, categoria, image, description) VALUES (?, ?, ?, ?, ?)",
                   (nome, preco, categoria, filename, description))
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
    cursor.execute("DELETE FROM produtos WHERE id=?", (id,))
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
        file.save(os.path.join(UPLOAD_FOLDER_PRODUCTS, filename))

    db = get_db()
    cursor = db.cursor()
    if filename:
        cursor.execute("UPDATE produtos SET nome=?, preco=?, categoria=?, image=?, description=? WHERE id=?",
                       (nome, preco, categoria, filename, description, id))
    else:
        cursor.execute("UPDATE produtos SET nome=?, preco=?, categoria=?, description=? WHERE id=?",
                       (nome, preco, categoria, description, id))
    db.commit()
    cursor.close()
    flash("Produto atualizado!", "success")
    return redirect(url_for('admin'))

# ------------------------------
# FUNÇÃO PARA GERAR PDF DE NOTA
# ------------------------------

def gerar_nota_pdf(pedido_id):
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT * FROM pedidos WHERE id=?", (pedido_id,))
    pedido = cursor.fetchone()
    if not pedido:
        cursor.close()
        return
    cursor.execute("""
        SELECT ip.produto_id, ip.quantidade, ip.preco_unitario, p.nome AS produto_nome
        FROM itens_pedido ip
        LEFT JOIN produtos p ON p.id = ip.produto_id
        WHERE ip.pedido_id=?
    """, (pedido_id,))
    itens = cursor.fetchall()
    cursor.close()

    filename = f"nota_{pedido_id}.pdf"
    filepath = os.path.join(app.config['NOTAS_FOLDER'], filename)

    doc = SimpleDocTemplate(filepath, pagesize=(226, 600),
                            leftMargin=10, rightMargin=10, topMargin=12, bottomMargin=12)
    styles = getSampleStyleSheet()
    estilo_titulo = ParagraphStyle('Titulo', parent=styles['Normal'], fontSize=12, alignment=TA_CENTER, spaceAfter=6)
    estilo_texto = ParagraphStyle('Texto', parent=styles['Normal'], fontSize=8, leading=10)
    estilo_negrito = ParagraphStyle('Negrito', parent=styles['Normal'], fontSize=8, leading=10, spaceAfter=4)

    elementos = []

    logo_path = os.path.join("static", "img", "logo.png")
    if os.path.exists(logo_path):
        img = Image(logo_path, width=60, height=60)
        img.hAlign = 'CENTER'
        elementos.append(img)
        elementos.append(Spacer(1, 4))

    elementos.append(Paragraph("<b>DEV RESTAURANTE</b>", estilo_titulo))
    elementos.append(Paragraph(f"<b>Pedido Nº:</b> {pedido['id']}", estilo_negrito))
    elementos.append(Paragraph(f"<b>Cliente:</b> {pedido['nome_cliente']}", estilo_texto))
    elementos.append(Paragraph(f"<b>Endereço:</b> {pedido['endereco']}", estilo_texto))
    elementos.append(Paragraph(f"<b>Bairro:</b> {pedido['bairro'] or '—'}", estilo_texto))
    elementos.append(Paragraph(f"<b>Telefone:</b> {pedido['telefone'] or '—'}", estilo_texto))
    elementos.append(Paragraph(f"<b>Pagamento:</b> {pedido['forma_pagamento'] or '—'}", estilo_texto))
    elementos.append(Spacer(1, 10))

    tabela_dados = [["QTD", "ITEM", "UNIT", "TOTAL"]]
    subtotal = 0
    for it in itens:
        qtd = it['quantidade']
        nome_item = it['produto_nome']
        preco = float(it['preco_unitario'])
        total = preco * qtd
        subtotal += total
        tabela_dados.append([str(qtd), nome_item, f"R$ {preco:.2f}", f"R$ {total:.2f}"])

    tabela = Table(tabela_dados, colWidths=[25, 95, 45, 45])
    tabela.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.2, colors.black),
        ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTSIZE', (0, 0), (-1, -1), 7),
    ]))
    elementos.append(tabela)
    elementos.append(Spacer(1, 12))

    delivery_fee = float(pedido['delivery_fee'] or 0)
    total_final = subtotal + delivery_fee
    elementos.append(Paragraph(f"<b>Subtotal:</b> R$ {subtotal:.2f}", estilo_negrito))
    elementos.append(Paragraph(f"<b>Entrega:</b> R$ {delivery_fee:.2f}", estilo_negrito))
    elementos.append(Paragraph(f"<b>Total Geral:</b> R$ {total_final:.2f}", estilo_negrito))
    elementos.append(Spacer(1, 15))
    elementos.append(Paragraph("Obrigado pela preferência!", estilo_titulo))

    doc.build(elementos)

# ------------------------------
# STARTUP
# ------------------------------

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=True)