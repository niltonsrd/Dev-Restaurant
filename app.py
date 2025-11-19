import os
from datetime import datetime, timezone
import decimal
import traceback
import sqlite3 # Trocamos mysql.connector por sqlite3

from flask import (
    Flask, render_template, render_template_string, g, jsonify,
    request, redirect, url_for, flash, send_from_directory, abort, make_response
)
from werkzeug.utils import secure_filename

# PDF
from reportlab.pdfgen import canvas

# === SISTEMA DE NOTIFICAÇÃO AO ADMIN ===
ULTIMO_PEDIDO_ID = 0

# -----------------------------------
# CONFIGURAÇÕES DO SISTEMA
# -----------------------------------

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATABASE_FILE = os.path.join(BASE_DIR, 'database.db') # Arquivo do SQLite

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
# BANCO DE DADOS (SQLite)
# -----------------------------------

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        # Conecta ao arquivo database.db
        db = g._database = sqlite3.connect(DATABASE_FILE)
        # Permite acessar colunas pelo nome (row['nome'])
        db.row_factory = sqlite3.Row 
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

# Helper para converter sqlite3.Row em dict real (para jsonify)
def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

def init_db():
    """Cria as tabelas se não existirem (SQLite)"""
    with app.app_context():
        db = get_db()
        cursor = db.cursor()
        
        # Tabela Produtos
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS produtos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                preco REAL NOT NULL,
                categoria TEXT,
                image TEXT,
                description TEXT
            )
        ''')

        # Tabela Pedidos
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS pedidos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome_cliente TEXT,
                endereco TEXT,
                bairro TEXT,
                total REAL,
                data TEXT,
                telefone TEXT,
                forma_pagamento TEXT,
                status TEXT DEFAULT 'pendente',
                observacoes TEXT,
                delivery_fee REAL DEFAULT 0
            )
        ''')

        # Tabela Itens do Pedido
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS itens_pedido (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pedido_id INTEGER,
                produto_id INTEGER,
                quantidade INTEGER,
                preco_unitario REAL,
                FOREIGN KEY(pedido_id) REFERENCES pedidos(id)
            )
        ''')
        
        db.commit()

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

# -----------------------------------
# ROTAS PÚBLICAS
# -----------------------------------

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/products')
def api_products():
    db = get_db()
    cursor = db.cursor() # Row factory já configurado no get_db
    cursor.execute("SELECT id, nome AS name, preco AS price, categoria AS category, image, description FROM produtos ORDER BY categoria, nome")
    rows = cursor.fetchall()
    
    # Converter para lista de dicts
    results = [dict(row) for row in rows]
    
    return jsonify(results)

@app.route('/api/categories')
def api_categories():
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT DISTINCT categoria FROM produtos ORDER BY categoria")
    rows = cursor.fetchall()
    # row[0] acessa a primeira coluna no sqlite3.Row também
    categories = ['Todos'] + [r[0] for r in rows if r[0]]
    return jsonify(categories)

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

    # TAXAS
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

    # Montagem da mensagem para WhatsApp (mantida igual)
    lines = []
    lines.append("🧾 *Pedido - Dev Restaurante*")
    lines.append(f"👤 Cliente: {customer_name}")
    lines.append(f"📍 Endereço: {customer_address}")
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

    # ---------- SALVAR NO BANCO (SQLite) ----------
    db = None
    try:
        db = get_db()
        cursor = db.cursor()
        
        # ATENÇÃO: SQLite usa '?' ao invés de '%s'
        insert_pedido = """
            INSERT INTO pedidos 
            (nome_cliente, endereco, bairro, total, data, telefone, forma_pagamento, status, observacoes, delivery_fee) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """

        now = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
        
        cursor.execute(insert_pedido, (
            customer_name,
            customer_address,
            customer_bairro,
            total_final, # float é aceito no sqlite
            now,
            customer_contact,
            payment_method,
            'pendente',
            customer_note,
            delivery_fee
        ))

        pedido_id = cursor.lastrowid

        insert_item = "INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)"
        
        for it in cart:
            produto_id = None
            try:
                produto_id = int(it.get('id') or it.get('product_id') or it.get('produto_id') or 0)
            except Exception:
                produto_id = 0
            qty = int(it.get('qty') or it.get('qtd') or it.get('quantity') or 1)
            price = float(it.get('price') or it.get('preco') or 0.0)
            
            cursor.execute(insert_item, (pedido_id, produto_id, qty, price))

        db.commit()
    except Exception as e:
        print("\n===== ERRO NO CHECKOUT =====")
        traceback.print_exc()
        if db:
            db.rollback()
        return jsonify({'ok': False, 'error': f'Erro ao salvar pedido: {str(e)}'}), 500

    global ULTIMO_PEDIDO_ID
    ULTIMO_PEDIDO_ID = pedido_id

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

# -----------------------------------
# ROTAS ADMINISTRATIVAS
# -----------------------------------

@app.route('/admin', methods=['GET', 'POST'])
def admin():
    if request.method == 'POST':
        password = request.form.get('password', '')
        if password == ADMIN_PASSWORD:
            response = redirect(url_for('admin'))
            response.set_cookie('admin_auth', '1', max_age=3600, httponly=True, samesite='Lax', path='/')
            return response
        flash("Senha incorreta", "error")
        return redirect(url_for('admin'))

    is_admin = request.cookies.get('admin_auth') == '1'
    if not is_admin:
        return render_template("login_admin.html")

    db = get_db()
    cursor = db.cursor()

    # buscar max id de pedidos/pedidos existentes (para inicializar o último ID visto)
    try:
        cursor.execute("SELECT MAX(id) FROM pedidos")
        row = cursor.fetchone()
        max_id = row[0] if row and row[0] is not None else 0
    except Exception:
        max_id = 0

    # carregar produtos
    cursor.execute("SELECT id, nome, preco, categoria, image, description FROM produtos ORDER BY id")
    prods = cursor.fetchall()

    products = []
    for p in prods:
        # p é sqlite3.Row — converter por key
        products.append({
            'id': p['id'],
            'name': p['nome'],
            'price': float(p['preco'] or 0.0),
            'category': p['categoria'],
            'image': p['image'] or '',
            'description': p['description'] or ''
        })

    return render_template("admin.html", admin=True, products=products, max_id=max_id)


@app.route('/admin/logout', methods=['GET', 'POST'])
def admin_logout():
    response = redirect(url_for('index'))
    response.set_cookie('admin_auth', '', expires=0, path='/')
    return response

# ROTAS CRUD DE PRODUTOS
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
    # SQLite usa ?
    cursor.execute(
        "INSERT INTO produtos (nome, preco, categoria, image, description) VALUES (?, ?, ?, ?, ?)",
        (nome, preco, categoria, filename, description)
    )
    db.commit()
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
        cursor.execute(
            "UPDATE produtos SET nome=?, preco=?, categoria=?, image=?, description=? WHERE id=?",
            (nome, preco, categoria, filename, description, id)
        )
    else:
        cursor.execute(
            "UPDATE produtos SET nome=?, preco=?, categoria=?, description=? WHERE id=?",
            (nome, preco, categoria, description, id)
        )
    db.commit()
    flash("Produto atualizado!", "success")
    return redirect(url_for('admin'))

# -----------------------------------
# ROTAS DE VENDAS E NOTAS
# -----------------------------------

@app.route('/admin/vendas')
def admin_vendas():
    if request.cookies.get('admin_auth') != '1':
        flash("Acesso negado", "error")
        return redirect(url_for('admin'))

    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT id, nome_cliente, endereco, telefone, total, forma_pagamento, status, observacoes, delivery_fee, data FROM pedidos ORDER BY data DESC")
    rows = cursor.fetchall()
    # Converter para dict manual pois sqlite3.Row não itera no template igual ao mysql dictionary
    pedidos = [dict(row) for row in rows]
    
    return render_template('admin_vendas.html', pedidos=pedidos)

@app.route('/admin/api/vendas')
def api_admin_vendas():
    if request.cookies.get('admin_auth') != '1':
        return jsonify({'ok': False, 'error': 'Acesso negado'}), 403
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT id, nome_cliente, endereco, telefone, total, forma_pagamento, status, observacoes, delivery_fee, data FROM pedidos ORDER BY data DESC")
    rows = cursor.fetchall()
    pedidos = [dict(row) for row in rows]
    return jsonify(pedidos)

@app.route('/admin/api/novos-pedidos')
def admin_api_novos_pedidos():
    if request.cookies.get('admin_auth') != '1':
        return jsonify({'ok': False, 'error': 'Acesso negado'}), 403

    ultimo_admin = int(request.args.get('ultimo', 0))

    db = get_db()
    cursor = db.cursor()
    try:
        cursor.execute("SELECT MAX(id) FROM pedidos")
        row = cursor.fetchone()
        max_id = row[0] if row and row[0] is not None else 0
    except Exception:
        max_id = 0

    if max_id > ultimo_admin:
        return jsonify({'novo': True, 'pedido_id': max_id})
    return jsonify({'novo': False})


@app.route('/admin/vendas/<int:pedido_id>/itens')
def admin_venda_itens(pedido_id):
    if request.cookies.get('admin_auth') != '1':
        return jsonify({'ok': False, 'error': 'Acesso negado'}), 403
    db = get_db()
    cursor = db.cursor()
    cursor.execute(
        "SELECT ip.id, ip.produto_id, ip.quantidade, ip.preco_unitario, p.nome AS produto_nome "
        "FROM itens_pedido ip LEFT JOIN produtos p ON p.id = ip.produto_id WHERE ip.pedido_id = ?",
        (pedido_id,)
    )
    rows = cursor.fetchall()
    itens = [dict(row) for row in rows]
    return jsonify(itens)

# GERAÇÃO DE NOTA PDF
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.units import mm
from datetime import datetime
import os

@app.route('/admin/vendas/<int:pedido_id>/nota')
def gerar_nota(pedido_id):
    if request.cookies.get('admin_auth') != '1':
        abort(403)

    db = get_db()
    cursor = db.cursor()

    cursor.execute("SELECT * FROM pedidos WHERE id = ?", (pedido_id,))
    pedido_row = cursor.fetchone()
    if not pedido_row:
        abort(404)
    pedido = dict(pedido_row)

    cursor.execute("""
        SELECT ip.produto_id, ip.quantidade, ip.preco_unitario, p.nome AS produto_nome
        FROM itens_pedido ip
        LEFT JOIN produtos p ON p.id = ip.produto_id
        WHERE ip.pedido_id = ?
    """, (pedido_id,))
    rows_itens = cursor.fetchall()
    itens = [dict(r) for r in rows_itens]

    # ================================
    # Preparação PDF Térmico 80mm
    # ================================
    filename = f"nota_{pedido_id}.pdf"
    filepath = os.path.join(app.config['NOTAS_FOLDER'], filename)

    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER
    from reportlab.lib import colors

    doc = SimpleDocTemplate(
        filepath,
        pagesize=(226, 600), 
        leftMargin=10,
        rightMargin=10,
        topMargin=12,
        bottomMargin=12
    )

    styles = getSampleStyleSheet()

    estilo_titulo = ParagraphStyle(
        'Titulo',
        parent=styles['Normal'],
        fontSize=12,
        alignment=TA_CENTER,
        spaceAfter=6,
        textColor=colors.black
    )

    estilo_texto = ParagraphStyle(
        'Texto',
        parent=styles['Normal'],
        fontSize=8,
        leading=10
    )

    estilo_negrito = ParagraphStyle(
        'Negrito',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        spaceAfter=4,
        textColor=colors.black
    )

    elementos = []

    # LOGO
    logo_path = os.path.join("static", "img", "logo.png")
    if os.path.exists(logo_path):
        img = Image(logo_path, width=60, height=60)
        img.hAlign = 'CENTER'
        elementos.append(img)
        elementos.append(Spacer(1, 4))

    # Cabeçalho
    elementos.append(Paragraph("<b>DEV RESTAURANTE</b>", estilo_titulo))
    elementos.append(Paragraph("CNPJ: 00.000.000/0001-00", estilo_texto))
    elementos.append(Paragraph("Endereço: Rua Exemplo, 123 - Centro", estilo_texto))
    elementos.append(Paragraph("Tel: (71) 99999-0000", estilo_texto))
    elementos.append(Spacer(1, 10))

    # Informações do pedido
    elementos.append(Paragraph(f"<b>Pedido Nº:</b> {pedido_id}", estilo_negrito))
    elementos.append(Paragraph(f"<b>Cliente:</b> {pedido['nome_cliente']}", estilo_texto))

    # Tratar data que vem como string do SQLite
    data_str = pedido['data']
    try:
        # Tenta converter string para datetime object
        dt_obj = datetime.strptime(data_str, '%Y-%m-%d %H:%M:%S')
        data_formatada = dt_obj.strftime("%d/%m/%Y — %H:%M")
    except:
        data_formatada = data_str

    elementos.append(Paragraph(f"<b>Pedido Recebido em:</b> {data_formatada}", estilo_texto))
    elementos.append(Paragraph(f"<b>Emitido em:</b> {datetime.now().strftime('%d/%m/%Y — %H:%M')}", estilo_texto))
    elementos.append(Paragraph(f"<b>Telefone:</b> {pedido.get('telefone') or '—'}", estilo_texto))
    elementos.append(Paragraph(f"<b>Endereço:</b> {pedido.get('endereco') or '—'}", estilo_texto))
    elementos.append(Paragraph(f"<b>Pagamento:</b> {pedido.get('forma_pagamento') or '—'}", estilo_texto))

    if pedido.get("observacoes"):
        elementos.append(Paragraph(f"<b>Obs:</b> {pedido['observacoes']}", estilo_texto))

    elementos.append(Spacer(1, 10))

    # Tabela de itens
    tabela_dados = [["QTD", "ITEM", "UNIT", "TOTAL"]]
    subtotal = 0

    for it in itens:
        nome_item = it.get('produto_nome') or 'Item'
        qtd = it['quantidade']
        preco = float(it['preco_unitario'])
        total = preco * qtd
        subtotal += total

        tabela_dados.append([
            str(qtd),
            nome_item,
            f"R$ {preco:.2f}",
            f"R$ {total:.2f}"
        ])

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

    # Totais
    delivery_fee = float(pedido.get("delivery_fee") or 0)
    total_final = subtotal + delivery_fee

    elementos.append(Paragraph(f"<b>Subtotal:</b> R$ {subtotal:.2f}", estilo_negrito))
    elementos.append(Paragraph(f"<b>Taxa de entrega:</b> R$ {delivery_fee:.2f}", estilo_negrito))
    elementos.append(Paragraph(f"<b>Total Geral:</b> R$ {total_final:.2f}", estilo_negrito))
    elementos.append(Spacer(1, 15))

    # Rodapé
    elementos.append(Paragraph("Obrigado pela preferência!", estilo_titulo))
    elementos.append(Paragraph("Sistema NTDEV — www.devrestaurante.com", estilo_texto))

    doc.build(elementos)
    return send_from_directory(app.config['NOTAS_FOLDER'], filename, as_attachment=False)

@app.route('/admin/vendas/<int:pedido_id>/status', methods=['POST'])
def api_update_venda_status(pedido_id):
    if request.cookies.get('admin_auth') != '1':
        return jsonify({'ok': False, 'error': 'Acesso negado'}), 403
    try:
        data = request.get_json() or {}
        status = data.get('status', 'pendente')
        db = get_db()
        cur = db.cursor()
        cur.execute("UPDATE pedidos SET status = ? WHERE id = ?", (status, pedido_id))
        db.commit()
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500

@app.route('/admin/vendas/<int:pedido_id>', methods=['DELETE'])
def api_delete_venda(pedido_id):
    if request.cookies.get('admin_auth') != '1':
        return jsonify({'ok': False, 'error': 'Acesso negado'}), 403
    try:
        db = get_db()
        cur = db.cursor()
        cur.execute("DELETE FROM itens_pedido WHERE pedido_id = ?", (pedido_id,))
        cur.execute("DELETE FROM pedidos WHERE id = ?", (pedido_id,))
        db.commit()
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500

# -----------------------------
# RUN
# -----------------------------
if __name__ == '__main__':
    init_db()
    # Inicializa o banco SQLite na primeira execução
    
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
