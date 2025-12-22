# app.py — versão reescrita para usar schema profissional (categories + products)
import os
import sqlite3
import traceback
import csv
import io
import json
import time
# 🟢 CORREÇÃO NAS IMPORTS: Mantenha timedelta e timezone
from datetime import datetime, timezone, timedelta 
from flask import (
    Flask, render_template, g, jsonify, request, redirect, url_for,
    flash, send_from_directory, abort, make_response, session
)
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash

# PDF (mantido)
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from urllib.parse import quote

# ... após as imports ...
from functools import wraps # ⬅️ GARANTA QUE ISTO ESTÁ IMPORTADO TAMBÉM

# ... outras configurações ...

ADMIN_RESET_TOKEN = "ntdev"


# --------------------------
# AUXILIARES DE ADMIN
# --------------------------

def is_admin_logged_in():
    """Checa se o admin está logado (baseado na variável de sessão)"""
    return session.get('admin_logged_in', False)

def admin_login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):

        # 🔥 AQUI ESTÁ A CHAVE
        if request.cookies.get("admin_auth") != "1":

            # Se for fetch / AJAX → JSON
            if request.headers.get("X-Requested-With") == "XMLHttpRequest":
                return jsonify({
                    "success": False,
                    "message": "Sessão expirada. Faça login novamente."
                }), 401

            # Navegação normal → redirect
            return redirect(url_for("admin_login"))

        return f(*args, **kwargs)
    return decorated

# -----------------------
# CONFIG
# -----------------------
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATABASE_FILE = os.path.join(BASE_DIR, 'database.db')

UPLOAD_FOLDER_PRODUCTS = os.path.join(BASE_DIR, 'static', 'img')
UPLOAD_FOLDER_PIX = os.path.join(BASE_DIR, 'static', 'pix_comprovantes')
NOTAS_FOLDER = os.path.join(BASE_DIR, 'static', 'notas')

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'gif'}

ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')
#RESTAURANT_PHONE = os.environ.get('RESTAURANT_PHONE', '5571991118924')
SERVER_URL = os.environ.get('SERVER_URL', None)

os.makedirs(UPLOAD_FOLDER_PRODUCTS, exist_ok=True)
os.makedirs(UPLOAD_FOLDER_PIX, exist_ok=True)
os.makedirs(NOTAS_FOLDER, exist_ok=True)

app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET', 'dev-secret')

# =============================
# Função get_db
# =============================
def get_db():
    if not hasattr(g, "_db"):
        g._db = sqlite3.connect(DATABASE_FILE)
        g._db.row_factory = sqlite3.Row
    return g._db

def get_admin_user():
    return get_setting("admin_user") or "admin"

def get_admin_password_hash():
    return get_setting("admin_password_hash") or ""


    # =========================================================
    # Função para buscar configurações na tabela settings
    # =========================================================
def get_setting(key):
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT value FROM settings WHERE key = ?", (key,))
    row = cur.fetchone()
    return row['value'] if row else None

# =============================
# Função get_settings
# =============================
def get_settings():
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT key, value FROM settings")
    rows = cur.fetchall()
    return {r["key"]: r["value"] for r in rows}


def update_setting(db, key, value):
    """Atualiza ou insere uma configuração no banco de dados."""
    # Garante que números com vírgula sejam tratados como ponto decimal
    if isinstance(value, str):
        value = value.replace(',', '.') 
        
    db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        (key, value)
    )

# =============================
# Inicializar tabela de settings
# =============================
def init_settings():
    db = get_db()
    cur = db.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)

    # valores iniciais (somente se não existir)
    defaults = {
        "whatsapp_number": "",
        "title": "Dev Restaurante",
        "description": "O melhor da região!",
        "logo": "",
        "background": ""
    }

    for k, v in defaults.items():
        cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", (k, v))

    db.commit()


def carregar_contexto_admin():
    db = get_db()
    cur = db.cursor()

    # produtos
    cur.execute("""
        SELECT p.id, p.name, p.price, p.image, p.description,
               c.name AS category
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        ORDER BY p.id
    """)
    products = cur.fetchall()

    # categorias
    cur.execute("SELECT id, name FROM categories ORDER BY name")
    categorias = cur.fetchall()

    settings = {
        "site_title": get_setting("site_title") or "Meu Restaurante",
        "logo_path": get_setting("logo_path") or "/static/img/logo.png",
    }

    return dict(
        admin=True,
        products=products,
        categorias=categorias,
        settings=settings
    )


def load_settings_dict():
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT key, value FROM settings")
    rows = cur.fetchall()
    return {r["key"]: r["value"] for r in rows}

def save_settings_dict(settings_dict):
    """
    Salva todas as configurações no banco de dados SQLite.
    Assume a existência de uma tabela 'settings' com colunas 'key' e 'value'.
    """
    db = get_db()
    cur = db.cursor()
    
    # Itera sobre o dicionário e insere/atualiza cada configuração
    for key, value in settings_dict.items():
        # Converte o valor para string antes de salvar
        value_str = str(value) if value is not None else '' 
        
        # Usa INSERT OR REPLACE para garantir que a chave é atualizada se já existir
        cur.execute("""
            INSERT OR REPLACE INTO settings (key, value) 
            VALUES (?, ?)
        """, (key, value_str))
        
    db.commit()


# =============================
# CHAMAR INICIALIZAÇÃO
# (Agora dentro de um contexto válido)
# =============================
with app.app_context():
    init_settings()

# =============================
# Outras configs
# =============================
app.config['UPLOAD_FOLDER_PRODUCTS'] = UPLOAD_FOLDER_PRODUCTS
app.config['UPLOAD_FOLDER_PIX'] = UPLOAD_FOLDER_PIX
app.config['NOTAS_FOLDER'] = NOTAS_FOLDER
app.config['PROPAGATE_EXCEPTIONS'] = True

# 🟢 GLOBAL TIMEZONE SETUP (Função utilitária para obter a hora de Brasília)
def now_br():
    """Retorna o objeto datetime.now() configurado para UTC-3 (Horário de Brasília)"""
    # Define o fuso horário local (UTC-3 para Brasília)
    fuso_br = timezone(timedelta(hours=-3))
    return datetime.now(fuso_br)

# -----------------------
# DB helpers
# -----------------------

# --------------------------------------------------------------------------
# Definição da função de conexão com o banco de dados
# --------------------------------------------------------------------------
def get_db_connection():
    """Cria e retorna uma conexão com o banco de dados SQLite."""
    conn = sqlite3.connect('database.db') # Ajuste o nome do arquivo se for diferente
    conn.row_factory = sqlite3.Row # Permite acessar colunas por nome
    return conn

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE_FILE)
        db.row_factory = sqlite3.Row
    return db

@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    """Rota para exibir o formulário de login e processar a autenticação."""
    if is_admin_logged_in():
        return redirect(url_for('admin'))

    if request.method == 'POST':
        password = request.form.get('password')
        
        # Você pode melhorar isso com hash de senha real, mas para o sistema simples:
        if password == ADMIN_PASSWORD:
            session['admin_logged_in'] = True
            flash('Login realizado com sucesso!', 'success')
            return redirect(url_for('admin'))
        else:
            flash('Senha incorreta.', 'error')
            
    # Rota GET - Renderiza a página de login
    return render_template('login_admin.html')



@app.teardown_appcontext
def close_connection(exc):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def exec_script(cursor, sql, params=()):
    cursor.execute(sql, params)
    return cursor

# -----------------------
# INIT DB + MIGRATION
# -----------------------
def init_db():
    """
    Cria as tabelas novas e migra dados antigos SEM DUPLICAR.
    """
    first_time = not os.path.exists(DATABASE_FILE)
    conn = sqlite3.connect(DATABASE_FILE)
    c = conn.cursor()

    # 1. Tabelas Novas
    c.execute('CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            category_id INTEGER,
            image TEXT,
            description TEXT,
            FOREIGN KEY(category_id) REFERENCES categories(id)
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome_cliente TEXT, endereco TEXT, bairro TEXT, total REAL, data TEXT, 
            telefone TEXT, forma_pagamento TEXT, status TEXT DEFAULT 'pendente', 
            observacoes TEXT, delivery_fee REAL DEFAULT 0
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS itens_pedido (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER, produto_id INTEGER, quantidade INTEGER, preco_unitario REAL,
            FOREIGN KEY(pedido_id) REFERENCES pedidos(id)
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS sizes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            name TEXT NOT NULL,
            FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
        )
    ''')
    conn.commit()

    # 2. Lógica de Migração Anti-Duplicação
    try:
        c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('produtos','categorias')")
        found = [r[0] for r in c.fetchall()]

        if 'categorias' in found:
            # Migra categorias
            c.execute("SELECT nome FROM categorias")
            old_cats = c.fetchall()
            for oc in old_cats:
                c.execute("INSERT OR IGNORE INTO categories (name) VALUES (?)", (oc[0],))
            conn.commit()

        if 'produtos' in found:
            # Migra produtos (Verificando duplicidade por nome)
            c.execute("SELECT nome, preco, categoria, image, description FROM produtos")
            old_prods = c.fetchall()
            
            for op in old_prods:
                nome, preco, cat_text, image, desc = op[0], op[1], op[2], op[3], op[4]
                
                # Verifica se já existe na tabela nova
                c.execute("SELECT id FROM products WHERE name = ?", (nome,))
                if c.fetchone():
                    continue # Pula se já existe

                # Acha ou cria categoria
                cat_id = None
                if cat_text:
                    c.execute("SELECT id FROM categories WHERE name = ?", (cat_text,))
                    row = c.fetchone()
                    if row:
                        cat_id = row[0]
                    else:
                        c.execute("INSERT INTO categories (name) VALUES (?)", (cat_text,))
                        cat_id = c.lastrowid

                c.execute("""
                    INSERT INTO products (name, price, category_id, image, description)
                    VALUES (?, ?, ?, ?, ?)
                """, (nome, preco, cat_id, image, desc))
                
            conn.commit()
            print("Migração verificada e concluída.")

    except Exception as e:
        print("Erro na migração (não crítico):", e)

    conn.close()

# -----------------------
# UTIL
# -----------------------
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# 🟢 CORREÇÃO NO save_image_file: Usa now_br() para nome do arquivo
def save_image_file(file_storage):
    if not file_storage:
        return None
    filename = secure_filename(file_storage.filename)
    if filename == '':
        return None
    if not allowed_file(filename):
        return None
    name, ext = os.path.splitext(filename)
    # Usa a função now_br() para o timestamp correto
    ts = now_br().strftime('%Y%m%d%H%M%S%f') 
    final = f"{name}_{ts}{ext}"
    dest = os.path.join(app.config['UPLOAD_FOLDER_PRODUCTS'], final)
    file_storage.save(dest)
    return final

def get_category_id_by_name(db, name):
    if not name:
        return None
    cur = db.cursor()
    cur.execute("SELECT id FROM categories WHERE name = ?", (name,))
    r = cur.fetchone()
    if r:
        return r['id']
    # cria se não existir
    try:
        cur.execute("INSERT INTO categories (name) VALUES (?)", (name,))
        db.commit()
        return cur.lastrowid
    except Exception:
        db.rollback()
        cur.execute("SELECT id FROM categories WHERE name = ?", (name,))
        rr = cur.fetchone()
        return rr['id'] if rr else None
    
def montar_descricao_item(options_json):
        """
        Converte opções JSON (size, ingredients, extras) em texto humanizado.
        Para itens não personalizáveis, retorna string vazia.
        """
        if not options_json:
            return ""
    
        # Garantir que é JSON válido
        try:
            opts = json.loads(options_json) if isinstance(options_json, str) else options_json
        except:
            return ""
    
        partes = []
    
        # Tamanho
        if opts.get("size") and opts["size"].get("name"):
            partes.append(f"Tamanho: {opts['size']['name']}")
    
        # Ingredientes
        if opts.get("ingredients"):
            ingredientes = ", ".join(i.get("name") for i in opts["ingredients"])
            partes.append(f"Sabores: {ingredientes}")

        # Extras
        if opts.get("extras"):
            extras = ", ".join(
                f"{e.get('name')} (+R$ {float(e.get('price',0)):.2f})"
                for e in opts["extras"]
            )
            partes.append(f"Adicionais: {extras}")
    
        return " | ".join(partes)  



@app.route('/admin/configuracoes/salvar', methods=['POST'])
@admin_login_required
def save_config():
    db = get_db()

    try:
        settings_to_save = {
            'whatsapp_number': request.form.get('whatsapp_number'),
            'site_title': request.form.get('site_title'),
            'site_description': request.form.get('site_description'),
            'cnpj': request.form.get('cnpj'),
            'address_street': request.form.get('address_street'),
            'address_number': request.form.get('address_number'),
            'address_city': request.form.get('address_city'),
            'address_state': request.form.get('address_state'),
            'delivery_cep_loja': request.form.get('delivery_cep_loja'),
            'delivery_taxa_fixa': request.form.get('delivery_taxa_fixa', '0.00').replace(',', '.'),
            'delivery_preco_km': request.form.get('delivery_preco_km', '0.00').replace(',', '.'),
            'delivery_taxa_maxima': request.form.get('delivery_taxa_maxima', '0.00').replace(',', '.'),
        }

        for key, value in settings_to_save.items():
            if value is not None:
                update_setting(db, key, value)

        # Upload logo
        logo_file = request.files.get('logo_file')
        if logo_file and allowed_file(logo_file.filename):
            filename = secure_filename(logo_file.filename)
            logo_file.save(os.path.join(UPLOAD_FOLDER_PRODUCTS, filename))
            update_setting(db, 'logo_path', url_for('static', filename=f'img/{filename}'))

        # Upload background
        background_file = request.files.get('background_file')
        if background_file and allowed_file(background_file.filename):
            filename = secure_filename(background_file.filename)
            background_file.save(os.path.join(UPLOAD_FOLDER_PRODUCTS, filename))
            update_setting(db, 'background_path', url_for('static', filename=f'img/{filename}'))

        db.commit()

        return jsonify({
            "success": True,
            "message": "Configurações salvas com sucesso."
        })

    except Exception as e:
        db.rollback()
        print("Erro:", e)
        return jsonify({
            "success": False,
            "message": "Erro ao salvar configurações."
        }), 500


  
@app.route("/api/buscar-endereco", methods=["POST"])
def buscar_endereco():
    import requests

    cep = request.form.get("cep", "").strip()

    if not cep or len(cep) != 8:
        return jsonify({"ok": False})

    try:
        r = requests.get(f"https://viacep.com.br/ws/{cep}/json/")
        data = r.json()

        if data.get("erro"):
            return jsonify({"ok": False})

        return jsonify({
            "ok": True,
            "logradouro": data.get("logradouro", ""),
            "bairro": data.get("bairro", ""),
            "cidade": data.get("localidade", ""),
            "estado": data.get("uf", "")
        })

    except:
        return jsonify({"ok": False})



import requests
import math

@app.route('/api/calcular-frete', methods=['POST'])
def calcular_frete():
    cep_cliente = request.form.get("cep", "").strip()

    if not cep_cliente:
        return jsonify({"ok": False, "error": "CEP inválido"}), 400

    db = get_db()

    cep_loja = get_setting("delivery_cep_loja") or ""
    taxa_fixa = float(get_setting("delivery_taxa_fixa") or 0)
    preco_km = float(get_setting("delivery_preco_km") or 0)
    taxa_maxima = float(get_setting("delivery_taxa_maxima") or 999)

    try:
        # Usando ViaCEP + OpenStreetMap (Nominatim)
        def get_coords(cep):
            r = requests.get(f"https://viacep.com.br/ws/{cep}/json/")
            data = r.json()
            if "erro" in data:
                return None
            addr = f"{data['logradouro']}, {data['localidade']} - {data['uf']}"
            geo = requests.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": addr, "format": "json"},
                headers={"User-Agent": "delivery-app"}
            ).json()
            if not geo:
                return None
            return float(geo[0]["lat"]), float(geo[0]["lon"])

        loja = get_coords(cep_loja)
        cliente = get_coords(cep_cliente)

        if not loja or not cliente:
            raise Exception("Erro ao localizar CEP")

        # Distância Haversine
        def haversine(lat1, lon1, lat2, lon2):
            R = 6371
            dlat = math.radians(lat2 - lat1)
            dlon = math.radians(lon2 - lon1)
            a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            return R * c

        distancia_km = haversine(loja[0], loja[1], cliente[0], cliente[1])

        taxa = taxa_fixa + (distancia_km * preco_km)
        taxa = min(taxa, taxa_maxima)

        return jsonify({
            "ok": True,
            "distance_km": round(distancia_km, 2),
            "delivery_fee": round(taxa, 2)
        })

    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500



# -----------------------
# ROTAS PÚBLICAS / API
# -----------------------
@app.route('/')
def index():
    def load_settings():
        db = get_db()
        cur = db.cursor()
        cur.execute("SELECT key, value FROM settings")
        rows = cur.fetchall()
        return {r["key"]: r["value"] for r in rows}
    settings = load_settings()
    return render_template('index.html', settings=settings)

@app.route('/api/products')
def api_products():
    db = get_db()
    cur = db.cursor()

    cur.execute("""
        SELECT 
            p.id,
            p.name,
            p.price,
            COALESCE(c.name, '') AS category,
            p.image,
            p.description,
            p.customizable
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        ORDER BY c.name, p.name
    """)

    rows = cur.fetchall()
    results = []

    for r in rows:
        results.append({
            'id': r['id'],
            'name': r['name'],
            'price': float(r['price'] or 0),
            'category': r['category'],
            'image': r['image'] or '',
            'description': r['description'] or '',
            'customizable': int(r['customizable'] or 0)  # <-- IMPORTANTE
        })

    return jsonify(results)


@app.route('/api/categories')
def api_categories():
    # Retorna lista de nomes (compatível com seu index.js: ["Todos", "Lanches"...])
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT name FROM categories ORDER BY name")
    rows = cur.fetchall()
    names = [r['name'] for r in rows if r['name']]
    return jsonify(["Todos"] + names)

@app.route('/api/categories_full')
def api_categories_full():
    # Retorna array de objetos {id, name} (opcional)
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT id, name FROM categories ORDER BY name")
    rows = cur.fetchall()
    cats = [{'id': r['id'], 'name': r['name']} for r in rows]
    return jsonify(cats)

@app.route("/admin/api/settings")
def api_get_settings():
    if request.cookies.get('admin_auth') != '1':
        return jsonify({"ok": False, "error": "Acesso negado"}), 403

    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT key, value FROM settings")
    rows = cur.fetchall()

    settings = {r["key"]: r["value"] for r in rows}
    return jsonify({"ok": True, "settings": settings})

@app.route("/admin/api/settings/save", methods=["POST"])
def api_save_settings():
    if request.cookies.get('admin_auth') != '1':
        return jsonify({"ok": False, "error": "Acesso negado"}), 403

    data = request.get_json() or {}

    db = get_db()
    cur = db.cursor()

    for key, value in data.items():
        cur.execute("""
            INSERT INTO settings (key, value)
            VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """, (key, value))

    db.commit()
    return jsonify({"ok": True})



# ================================
# ROTA PÚBLICA - DETALHES DE PRODUTO
# Permite que o cliente veja tamanhos, ingredientes e extras
# ================================

# -----------------------
# CHECKOUT
# -----------------------
@app.route('/api/checkout', methods=['POST'])
def api_checkout():
    import json, traceback, time, os
    from urllib.parse import quote
    from werkzeug.utils import secure_filename
    
    # ⚠️ ATENÇÃO: Assumindo que você tem as funções auxiliares (get_settings, load_settings_dict, get_db, now_br) e variáveis globais (BASE_DIR) definidas no seu escopo.

    data = request.form

    # ------------------------------
    #   CAMPOS DO CLIENTE (SIMPLIFICADO e CORRIGIDO)
    # ------------------------------
    customer_name = (data.get('customer_name') or data.get('customerName') or data.get('name') or '').strip()
    customer_contact = (data.get('customer_contact') or data.get('customerContact') or '').strip()
    customer_note = (data.get('customer_note') or data.get('customerNote') or '').strip()
    customer_bairro = (data.get('customer_bairro') or data.get('customerBairro') or data.get('bairro') or '').strip()

    # 🟢 CORREÇÃO FINAL DO ENDEREÇO: O script.js envia apenas o campo concatenado 'customer_address'.
    customer_address = (data.get('customer_address') or data.get('customerAddress') or data.get('address') or '').strip()

    if not customer_address:
        customer_address = "Endereço não informado"

    print(f"DEBUG: customer_address recebido: {customer_address}")    
    
    # ------------------------------
    #   RESTO DOS CAMPOS
    # ------------------------------

    payment_method = (data.get('payment_method') or data.get('paymentMethod') or '').strip().lower()
    troco_para = (data.get('troco_para') or data.get('trocoPara') or '').strip()
    delivery_override = data.get('delivery_tax') or data.get('deliveryTax') or data.get('delivery_fee') or None

    # ------------------------------
    #   CARRINHO
    # ------------------------------
    cart_json = data.get('cart') or data.get('cart_json') or data.get('carrinho') or '[]'

    try:
        cart = json.loads(cart_json)
        if not isinstance(cart, list):
            cart = []
    except:
        cart = []

    if not customer_name or customer_address == "Endereço não informado" or not cart:
         return jsonify({'ok': False, 'error': 'Preencha nome, endereço e itens.'}), 400


    # ------------------------------
    #   FRETE
    # ------------------------------
    try:
        if delivery_override:
            delivery_fee = float(str(delivery_override).replace(",", "."))
        else:
            delivery_fee = 0.0
    except:
        delivery_fee = 0.0


    settings = get_settings()

    restaurant_name = settings.get("site_title", "Meu Restaurante")
    restaurant_desc = settings.get("site_description", "")
    restaurant_phone = settings.get("whatsapp_number", "")
    logo_path = settings.get("logo_path", "")
    background_path = settings.get("background_path", "")

    # ------------------------------
    #   MONTAR TEXTO WHATSAPP (MODELO B)
    # ------------------------------
    settings = load_settings_dict()

    restaurant_name = settings.get("site_title", "Restaurante")
    store_whatsapp = settings.get("whatsapp_number", "")
    store_address = f"{settings.get('address_street', '')}, {settings.get('address_number', '')}"
    store_city = f"{settings.get('address_city', '')} - {settings.get('address_state', '')}"

    pix_file = request.files.get("pix_comprovante")
    pix_path = None

    if payment_method == "pix" and pix_file and pix_file.filename:
        filename = secure_filename(pix_file.filename)
        unique_name = f"pix_{int(time.time())}_{filename}"
        pix_path = f"/static/pix_comprovantes/{unique_name}"

        # Corrigindo o salvamento do PIX para garantir que o diretório exista
        try:
            os.makedirs(os.path.join(BASE_DIR, 'static', 'pix_comprovantes'), exist_ok=True)
            pix_file.save(os.path.join(BASE_DIR, 'static', 'pix_comprovantes', unique_name))
        except:
             pix_path = None # Se falhar, não salva o caminho

    lines = []
    lines.append(f"🧾 *Pedido - {restaurant_name}*")
    lines.append(f"🏪 {store_address}")
    lines.append(f"📍 {store_city}")
    lines.append("")
    lines.append(f"👤 Cliente: {customer_name}")
    lines.append(f"📍 Endereço: {customer_address}") # <-- Endereço capturado
    if customer_bairro: lines.append(f"🏙️ Bairro: {customer_bairro}")
    if customer_contact: lines.append(f"📞 Contato: {customer_contact}")
    if customer_note: lines.append(f"📝 Obs: {customer_note}")
    lines.append("")
    lines.append(f"💳 *Pagamento:* {payment_method.capitalize()} -- O Motoboy leva a máquininha")

    if payment_method == "dinheiro" and troco_para:
        try:
            v = float(troco_para.replace(",", "."))
            lines.append(f"Troco para: R$ {v:.2f}")
        except:
            lines.append(f"Troco para: {troco_para}")
    else:
        lines.append("✅ Sem troco")

    if payment_method == "pix":
       lines.append("💠 *PIX:*")

    if pix_path:
        full_link = request.host_url.rstrip("/") + pix_path
        lines.append("📎 *Comprovante:*")
        lines.append(full_link)
    else:
        lines.append("⚠️ *Comprovante não enviado*")


    lines.append("")
    lines.append("🍔 *Itens:*")
    lines.append("")

    total_items = 0.0

    # ------------------------------
    #   LOOP DOS ITENS
    # ------------------------------
    for it in cart:

        name = it.get("name") or "Item"
        qty = int(it.get("qty") or 1)

        # preço final do item
        try:
            price = float(str(it.get("unit_price") or 0).replace(",", "."))
        except:
            price = 0.0

        subtotal = price * qty
        total_items += subtotal

        # opções
        opts = it.get("options") or {}
        if isinstance(opts, str):
            try: opts = json.loads(opts)
            except: opts = {}
        
        # 🟢 Corrigindo o 'nan': Garante que base_price seja um número válido
        try:
            base_price = float(str(it.get("unit_price") or 0).replace(",", "."))
        except:
            base_price = 0.0


        # ---- MODELO B ----
        lines.append(f"🍕 *{name}*")
        lines.append(f"• Preço base: *R$ {base_price:.2f}*") # <-- Corrigido (R$ nan)


        # tamanho
        size = opts.get("size")
        if size:
            sname = size.get("name")
            sextra = float(size.get("extra_price") or 0)
            if sextra > 0:
                lines.append(f"• Tamanho: {sname} (+R$ {sextra:.2f})")
            else:
                lines.append(f"• Tamanho: {sname}")

        # ingredientes
        ingredients = opts.get("ingredients") or []
        if ingredients:
            ing_list = ", ".join(i.get("name") for i in ingredients)
            lines.append(f"• Sabores: {ing_list}")

        # extras
        extras = opts.get("extras") or []
        if extras:
            lines.append("• Adicionais:")
            for ex in extras:
                en = ex.get("name")
                ep = float(ex.get("price") or 0)
                lines.append(f"   - {en} (+R$ {ep:.2f})")

        # total do item
        lines.append(f"➡ *Total do item:* R$ {subtotal:.2f}")
        lines.append("")

    # ------------------------------
    #   TOTAL + ENTREGA
    # ------------------------------
    lines.append(f"🚚 Entrega: R$ {delivery_fee:.2f}")

    total_final = total_items + delivery_fee
    lines.append(f"💰 *Total:* R$ {total_final:.2f}")


    lines.append("")
    lines.append(f"📨 Pedido enviado via site {restaurant_name}.")

    # formatar para URL
    raw_text = "\n".join(lines)
    encoded_text = quote(raw_text)

    whatsapp_url = f"https://api.whatsapp.com/send?phone={restaurant_phone}&text={encoded_text}"

    # ------------------------------
    #   SALVAR PEDIDO NO BANCO
    # ------------------------------
    try:
        db = get_db()
        cur = db.cursor()

        now = now_br().strftime("%Y-%m-%d %H:%M:%S")

        cur.execute("""
    INSERT INTO pedidos 
    (nome_cliente, endereco, bairro, total, data, telefone,
     forma_pagamento, status, observacoes, delivery_fee, pix_comprovante)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
""", (
    customer_name,
    customer_address, 
    customer_bairro,
    total_final,
    now,
    customer_contact,
    payment_method,
    "pendente",
    customer_note,
    delivery_fee,
    pix_path
))

        pedido_id = cur.lastrowid

        # SALVAR ITENS
        for it in cart:
            produto_id = int(it.get("product_id") or 0)
            qty = int(it.get("qty") or 1)

            try:
                price = float(str(it.get("unit_price") or 0).replace(",", "."))
            except:
                price = 0.0

            opts_json = json.dumps(it.get("options") or {}, ensure_ascii=False)

            cur.execute("""
                INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario, options, name)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                pedido_id,
                produto_id,
                qty,
                price,
                opts_json,
                it.get("name")
            ))

        db.commit()

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'ok': False,
            'error': f'Erro ao salvar pedido: {str(e)}'
        }), 500

    # ------------------------------
    #   RETORNO FINAL
    # ------------------------------
    return jsonify({
    'ok': True,
    'whatsapp_url': whatsapp_url,
    'pedido_id': pedido_id,
    'pix_path': pix_path,
    'total': f"{total_final:.2f}"
})






@app.route('/pix/<filename>')
def get_pix_file(filename):
    return send_from_directory(UPLOAD_FOLDER_PIX, filename)

# -----------------------
# ADMIN (render + CRUD)
# -----------------------
@app.route('/admin', methods=['GET', 'POST'])
def admin():
    # ==========================
    # LOGIN (POST)
    # ==========================
    if request.method == 'POST':
        password = request.form.get('password', '')

        admin_hash = get_setting("admin_password_hash") or ""

        # 🔐 Se ainda não tem hash salvo, usa ADMIN_PASSWORD
        if admin_hash == "":
            if password == ADMIN_PASSWORD:
                resp = redirect(url_for('admin'))
                resp.set_cookie(
                    'admin_auth',
                    '1',
                    max_age=3600,
                    httponly=True,
                    samesite='Lax',
                    path='/'
                )
                return resp
        else:
            if check_password_hash(admin_hash, password):
                resp = redirect(url_for('admin'))
                resp.set_cookie(
                    'admin_auth',
                    '1',
                    max_age=3600,
                    httponly=True,
                    samesite='Lax',
                    path='/'
                )
                return resp

        flash("Senha incorreta", "error")
        return redirect(url_for('admin'))

    # ==========================
    # VERIFICA LOGIN (GET)
    # ==========================
    is_admin = request.cookies.get('admin_auth') == '1'
    if not is_admin:
        return render_template('login_admin.html')

    db = get_db()
    cur = db.cursor()



    # dicionário com todas as configs que o admin precisa
    settings = {
    "whatsapp_number": get_setting("whatsapp_number") or "",
    "site_title": get_setting("site_title") or "Meu Restaurante",
    "site_description": get_setting("site_description") or "",
    "logo_path": get_setting("logo_path") or "/static/img/logo.png",
    "background_path": get_setting("background_path") or "/static/img/bg.jpg",

    # 🔥 DADOS DA LOJA
    "cnpj": get_setting("cnpj") or "",
    "address_street": get_setting("address_street") or "",
    "address_number": get_setting("address_number") or "",
    "address_city": get_setting("address_city") or "",
    "address_state": get_setting("address_state") or "",

    # 🔥 CONFIGURAÇÕES DE ENTREGA
    "delivery_cep_loja": get_setting("delivery_cep_loja") or "",
    "delivery_taxa_fixa": get_setting("delivery_taxa_fixa") or "",
    "delivery_preco_km": get_setting("delivery_preco_km") or "",
    "delivery_taxa_maxima": get_setting("delivery_taxa_maxima") or "",
    }



    # =========================================================
    # Carregar produtos
    # =========================================================
    cur.execute("""
        SELECT p.id, p.name, p.price, p.image, p.description, 
               c.id AS category_id, c.name AS category_name
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        ORDER BY p.id
    """)
    prods = cur.fetchall()

    products = []
    for p in prods:
        products.append({
            'id': p['id'],
            'name': p['name'],
            'price': float(p['price'] or 0.0),
            'category_id': p['category_id'],
            'category': p['category_name'] or '',
            'image': p['image'] or '',
            'description': p['description'] or ''
        })

    # =========================================================
    # Categorias
    # =========================================================
    cur.execute("SELECT id, name FROM categories ORDER BY name")
    cats = cur.fetchall()
    categorias = [{'id': c['id'], 'name': c['name']} for c in cats]

    # =========================================================
    # Último pedido
    # =========================================================
    try:
        cur.execute("SELECT MAX(id) as maxid FROM pedidos")
        row = cur.fetchone()
        max_id = row['maxid'] if row and row['maxid'] is not None else 0
    except:
        max_id = 0

    return render_template(
        'admin.html',
        admin=True,
        products=products,
        categorias=categorias,
        max_id=max_id,
        settings=settings   # 🔥 ESSA LINHA É O QUE FALTAVA
    )

@app.route('/admin/alterar-senha', methods=['POST'])
def admin_alterar_senha():

    # só admin logado
    if request.cookies.get('admin_auth') != '1':
        return {
            "success": False,
            "message": "Acesso negado."
        }

    senha_atual = request.form.get('senha_atual', '').strip()
    nova_senha = request.form.get('nova_senha', '').strip()
    confirmar_senha = request.form.get('confirmar_senha', '').strip()

    # ======================
    # VALIDAÇÕES
    # ======================

    if not senha_atual or not nova_senha or not confirmar_senha:
        return {
            "success": False,
            "message": "Preencha todos os campos."
        }

    if nova_senha != confirmar_senha:
        return {
            "success": False,
            "message": "As senhas não coincidem."
        }

    if len(nova_senha) < 6:
        return {
            "success": False,
            "message": "A nova senha deve ter pelo menos 6 caracteres."
        }

    admin_hash = get_setting("admin_password_hash") or ""

    if admin_hash == "":
        if senha_atual != ADMIN_PASSWORD:
            return {
                "success": False,
                "message": "Senha atual incorreta."
            }
    else:
        if not check_password_hash(admin_hash, senha_atual):
            return {
                "success": False,
                "message": "Senha atual incorreta."
            }

    # ======================
    # SALVA NOVA SENHA
    # ======================

    nova_hash = generate_password_hash(nova_senha)

    db = get_db()
    cur = db.cursor()
    cur.execute("""
        INSERT INTO settings (key, value)
        VALUES ('admin_password_hash', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
    """, (nova_hash,))
    db.commit()

    # ======================
    # SUCESSO
    # ======================

    resp = make_response({
        "success": True,
        "message": "Senha alterada com sucesso. Faça login novamente."
    })

    # força logout
    resp.set_cookie('admin_auth', '', expires=0)
    return resp

from flask import abort

# ROTA DE RESET DE SENHA (PÚBLICA, COM TOKEN)
@app.route('/admin/reset-senha/<token>')
def admin_reset_senha(token):

    # token inválido = acesso negado
    if token != ADMIN_RESET_TOKEN:
        abort(403)

    db = get_db()
    cur = db.cursor()

    # remove a senha personalizada
    cur.execute("""
        DELETE FROM settings
        WHERE key = 'admin_password_hash'
    """)

    db.commit()

    return """
    <h2>Senha resetada com sucesso</h2>
    <p>Agora você pode logar usando a senha padrão do sistema.</p>
    <p><strong>Recomenda-se trocar a senha após o login.</strong></p>
    """



@app.route("/admin/configuracoes/salvar", methods=["POST"])
def salvar_configuracoes():
    if request.cookies.get("admin_auth") != "1":
        return jsonify({
            "success": False,
            "message": "Sessão expirada. Faça login novamente."
        }), 403

    db = get_db()
    cur = db.cursor()

    def set_setting(key, value):
        cur.execute("""
            INSERT INTO settings (key, value)
            VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """, (key, value))

    try:
        # ================= TEXTOS =================
        set_setting("whatsapp_number", request.form.get("whatsapp_number", ""))
        set_setting("site_title", request.form.get("site_title", ""))
        set_setting("site_description", request.form.get("site_description", ""))

        # ================= ENDEREÇO =================
        set_setting("cnpj", request.form.get("cnpj", ""))
        set_setting("address_street", request.form.get("address_street", ""))
        set_setting("address_number", request.form.get("address_number", ""))
        set_setting("address_city", request.form.get("address_city", ""))
        set_setting("address_state", request.form.get("address_state", ""))

        # ================= ENTREGA =================
        set_setting("delivery_cep_loja", request.form.get("delivery_cep_loja", ""))
        set_setting("delivery_taxa_fixa", request.form.get("delivery_taxa_fixa", "0"))
        set_setting("delivery_preco_km", request.form.get("delivery_preco_km", "0"))
        set_setting("delivery_taxa_maxima", request.form.get("delivery_taxa_maxima", "0"))

        # ================= IMAGENS =================
        os.makedirs("static/img", exist_ok=True)

        logo = request.files.get("logo_file")
        if logo and logo.filename:
            filename = secure_filename(logo.filename)
            logo.save(os.path.join("static", "img", filename))
            set_setting("logo_path", f"/static/img/{filename}")

        bg = request.files.get("background_file")
        if bg and bg.filename:
            filename = secure_filename(bg.filename)
            bg.save(os.path.join("static", "img", filename))
            set_setting("background_path", f"/static/img/{filename}")

        db.commit()

        return jsonify({
            "success": True,
            "message": "Configurações salvas com sucesso."
        })

    except Exception as e:
        db.rollback()
        return jsonify({
            "success": False,
            "message": f"Erro ao salvar configurações: {str(e)}"
        }), 500



@app.route('/admin/logout', methods=['POST'])
def admin_logout():
    resp = redirect(url_for('admin'))

    # remove o cookie de autenticação
    resp.set_cookie(
        'admin_auth',
        '',
        expires=0,
        path='/'
    )

    flash('Você saiu do painel administrativo.', 'info')
    return resp


# Produtos CRUD (admin)
@app.route('/admin/add', methods=['POST'])
def admin_add():
    if request.cookies.get('admin_auth') != '1':
        flash("Acesso negado", "error")
        return redirect(url_for('admin'))

    # 1. Dados básicos do produto
    name = request.form.get('name')
    price = request.form.get('price') or 0
    category_val = request.form.get('category')
    description = request.form.get('description')
    file = request.files.get('image')

    customizable = 1 if request.form.get('customizable') == '1' else 0

    db = get_db()
    cur = db.cursor()

    # 2. Categoria
    cat_id = None
    if category_val:
        try:
            cat_id = int(category_val)
        except Exception:
            cat_id = get_category_id_by_name(db, category_val.strip())

    # 3. Imagem
    filename = None
    if file and allowed_file(file.filename):
        filename = save_image_file(file)

    try:
        # 4. Insere o produto principal
        cur.execute("""
            INSERT INTO products (name, price, category_id, image, description, customizable)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (name, price, cat_id, filename, description, customizable))

        product_id = cur.lastrowid

        # ============================================================
        # 🔥 SALVAR TAMANHOS (tamanho + extra_price)
        # tamanhos_name[]  | tamanhos_extra[]
        # ============================================================
        sizes_name = request.form.getlist("sizes_name[]")
        sizes_extra = request.form.getlist("sizes_extra[]")

        for nome, extra in zip(sizes_name, sizes_extra):
            if nome.strip():
                cur.execute("""
                    INSERT INTO sizes (product_id, name, extra_price)
                    VALUES (?, ?, ?)
                """, (product_id, nome.strip(), float(extra or 0)))

        # ============================================================
        # 🟢 SALVAR INGREDIENTES (ingredients_name[])
        # ============================================================
        ingredients_name = request.form.getlist("ingredients_name[]")

        for ing in ingredients_name:
            if ing.strip():
                cur.execute("""
                    INSERT INTO product_ingredients (product_id, name)
                    VALUES (?, ?)
                """, (product_id, ing.strip()))

        # ============================================================
        # 🔵 SALVAR EXTRAS (extras_name[] | extras_price[])
        # ============================================================
        extras_name = request.form.getlist("extras_name[]")
        extras_price = request.form.getlist("extras_price[]")

        for nome, preco in zip(extras_name, extras_price):
            if nome.strip():
                cur.execute("""
                    INSERT INTO product_extras (product_id, name, price)
                    VALUES (?, ?, ?)
                """, (product_id, nome.strip(), float(preco or 0)))

        db.commit()
        flash("Produto completo adicionado com sucesso!", "success")

    except Exception as e:
        db.rollback()
        print("Erro ao criar produto:", e)
        flash(f"Erro ao adicionar produto: {e}", "error")

    return redirect(url_for('admin'))


# --- API PARA O MODAL COMPLETO (Tamanhos, Ingredientes, Adicionais) ---

# 1. Rota que busca TUDO de um produto para preencher o modal
@app.route("/api/product/<int:product_id>/details")
def api_product_details(product_id):
    conn = get_db_connection()

    # Tamanhos
    sizes = conn.execute("""
        SELECT id, name, extra_price
        FROM sizes
        WHERE product_id = ?
    """, (product_id,)).fetchall()

    # Ingredientes (correção aqui ↓↓↓↓)
    ingredients = conn.execute("""
        SELECT id, name
        FROM product_ingredients
        WHERE product_id = ?
    """, (product_id,)).fetchall()

    ingredients_list = [
        {"id": i["id"], "name": i["name"], "price": 0}
        for i in ingredients
    ]

    # Extras
    extras = conn.execute("""
        SELECT id, name, price
        FROM product_extras
        WHERE product_id = ?
    """, (product_id,)).fetchall()

    conn.close()

    return jsonify({
        "sizes": [dict(s) for s in sizes],
        "ingredients": ingredients_list,
        "extras": [dict(e) for e in extras]
    })


# 2. Rotas para Adicionar/Remover INGREDIENTES
@app.route('/admin/api/product/<int:id>/ingredient', methods=['POST'])
def api_add_ingredient(id):
    data = request.get_json()
    nome = data.get('nome')
    if not nome: return jsonify({'error': 'Nome obrigatório'}), 400
    
    db = get_db()
    db.execute("INSERT INTO product_ingredients (product_id, name) VALUES (?, ?)", (id, nome))
    db.commit()
    return jsonify({'message': 'OK'})

@app.route('/admin/api/ingredient/<int:id>', methods=['DELETE'])
def api_delete_ingredient(id):
    db = get_db()
    db.execute("DELETE FROM product_ingredients WHERE id = ?", (id,))
    db.commit()
    return jsonify({'message': 'OK'})

# 3. Rotas para Adicionar/Remover ADICIONAIS (EXTRAS)
@app.route('/admin/api/product/<int:id>/extra', methods=['POST'])
def api_add_extra(id):
    data = request.get_json()
    nome = data.get('nome')
    price = data.get('price') or 0
    if not nome: return jsonify({'error': 'Nome obrigatório'}), 400
    
    db = get_db()
    db.execute("INSERT INTO product_extras (product_id, name, price) VALUES (?, ?, ?)", (id, nome, price))
    db.commit()
    return jsonify({'message': 'OK'})

@app.route('/admin/api/extra/<int:id>', methods=['DELETE'])
def api_delete_extra(id):
    db = get_db()
    db.execute("DELETE FROM product_extras WHERE id = ?", (id,))
    db.commit()
    return jsonify({'message': 'OK'})

# Rota para LISTAR e ADICIONAR tamanhos via Javascript
@app.route('/admin/api/product/<int:id>/sizes', methods=['GET', 'POST'])
def api_manage_sizes(id):
    db = get_db()
    cur = db.cursor()

    cur.execute("SELECT id FROM products WHERE id = ?", (id,))
    if not cur.fetchone():
        return jsonify({'error': 'Produto não encontrado'}), 404

    if request.method == 'POST':
        data = request.get_json()
        nome_tamanho = data.get('nome')
        preco_extra = data.get('preco', 0)

        if not nome_tamanho:
            return jsonify({'error': 'Nome é obrigatório'}), 400

        try:
            cur.execute("""
                INSERT INTO sizes (product_id, name, extra_price)
                VALUES (?, ?, ?)
            """, (id, nome_tamanho, preco_extra))

            db.commit()
            return jsonify({'message': 'Tamanho adicionado!'})
        except Exception as e:
            db.rollback()
            return jsonify({'error': str(e)}), 500

    cur.execute("SELECT id, name, extra_price FROM sizes WHERE product_id = ?", (id,))
    rows = cur.fetchall()

    tamanhos = [
        {'id': r['id'], 'nome': r['name'], 'preco': r['extra_price']}
        for r in rows
    ]
    return jsonify(tamanhos)

@app.route("/api/product/<int:id>/details")
def public_product_details(id):
    db = get_db()
    cur = db.cursor()

    # Produto
    cur.execute("""
        SELECT id, name, price, image, description, customizable
        FROM products WHERE id = ?
    """, (id,))
    prod = cur.fetchone()
    if not prod:
        return jsonify({"error": "Produto não encontrado"}), 404

    # -------------------------
    # Tamanhos (com extra_price)
    # -------------------------
    cur.execute("""
        SELECT id, name, extra_price
        FROM sizes
        WHERE product_id = ?
    """, (id,))
    sizes = [
        {
            "id": row["id"],
            "name": row["name"],
            "extra_price": float(row["extra_price"] or 0)
        }
        for row in cur.fetchall()
    ]

    # -------------------------
    # Ingredientes (SEM preço)
    # Junta product_ingredients -> ingredients
    # -------------------------
    cur.execute("""
        SELECT pi.id AS id, ing.name AS name
        FROM product_ingredients pi
        JOIN ingredients ing ON ing.id = pi.ingredient_id
        WHERE pi.product_id = ?
    """, (id,))
    ingredients = [
        {
            "id": row["id"],
            "name": row["name"],
            "price": 0.0   # ingredientes não têm preço
        }
        for row in cur.fetchall()
    ]

    # -------------------------
    # Extras (com preço)
    # -------------------------
    cur.execute("""
        SELECT id, name, price
        FROM product_extras
        WHERE product_id = ?
    """, (id,))
    extras = [
        {
            "id": row["id"],
            "name": row["name"],
            "price": float(row["price"] or 0)
        }
        for row in cur.fetchall()
    ]

    # -------------------------
    # Retorno final
    # -------------------------
    return jsonify({
        "product": {
            "id": prod["id"],
            "name": prod["name"],
            "price": float(prod["price"]),
            "image": prod["image"],
            "description": prod["description"],
            "customizable": prod["customizable"]
        },
        "sizes": sizes,
        "ingredients": ingredients,
        "extras": extras
    })





@app.route('/admin/api/size/<int:id_tamanho>', methods=['DELETE'])
def api_delete_size(id_tamanho):
    db = get_db()
    cur = db.cursor()
    try:
        cur.execute("DELETE FROM sizes WHERE id = ?", (id_tamanho,))
        db.commit()
        return jsonify({'message': 'Removido'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/admin/edit/<int:id>', methods=['POST'])
def admin_edit(id):
    if request.cookies.get('admin_auth') != '1':
        flash("Acesso negado", "error")
        return redirect(url_for('admin'))

    name = request.form.get('name')
    price = request.form.get('price') or 0
    category_val = request.form.get('category')
    description = request.form.get('description')
    file = request.files.get('image')

    db = get_db()
    cur = db.cursor()

    cat_id = None
    if category_val:
        try:
            cat_id = int(category_val)
        except Exception:
            cat_id = get_category_id_by_name(db, category_val.strip())

    filename = None
    if file and allowed_file(file.filename):
        filename = save_image_file(file)

    try:
        if filename:
            cur.execute("""
                UPDATE products SET name=?, price=?, category_id=?, image=?, description=? WHERE id=?
            """, (name, price, cat_id, filename, description, id))
        else:
            cur.execute("""
                UPDATE products SET name=?, price=?, category_id=?, description=? WHERE id=?
            """, (name, price, cat_id, description, id))
        db.commit()
        flash("Produto atualizado!", "success")
    except Exception as e:
        db.rollback()
        flash(f"Erro ao atualizar produto: {e}", "error")

    return redirect(url_for('admin'))

@app.route("/admin/api/product/<int:id>/full_details", methods=["GET"])
def admin_api_full_details(id):
    db = get_db()
    cur = db.cursor()

    # Verifica se o produto existe
    cur.execute("SELECT id FROM products WHERE id = ?", (id,))
    if not cur.fetchone():
        return jsonify({"error": "Produto não encontrado"}), 404

    # ---- LISTAR TAMANHOS ----
    cur.execute("""
        SELECT id, name, extra_price
        FROM sizes
        WHERE product_id = ?
    """, (id,))
    sizes = [
        {
            "id": row["id"],
            "name": row["name"],
            "extra_price": row["extra_price"]
        }
        for row in cur.fetchall()
    ]

    # ---- LISTAR INGREDIENTES ----
    cur.execute("""
        SELECT id, name
        FROM product_ingredients
        WHERE product_id = ?
    """, (id,))
    ingredients = [
        {
            "id": row["id"],
            "name": row["name"]
        }
        for row in cur.fetchall()
    ]

    # ---- LISTAR EXTRAS ----
    cur.execute("""
        SELECT id, name, price
        FROM product_extras
        WHERE product_id = ?
    """, (id,))
    extras = [
        {
            "id": row["id"],
            "name": row["name"],
            "price": row["price"]
        }
        for row in cur.fetchall()
    ]

    return jsonify({
        "sizes": sizes,
        "ingredients": ingredients,
        "extras": extras
    })


@app.route('/admin/delete/<int:id>', methods=['POST'])
def admin_delete(id):
    if request.cookies.get('admin_auth') != '1':
        flash("Acesso negado", "error")
        return redirect(url_for('admin'))
    db = get_db()
    cur = db.cursor()
    try:
        cur.execute("DELETE FROM products WHERE id = ?", (id,))
        db.commit()
        flash("Produto removido.", "success")
    except Exception as e:
        db.rollback()
        flash(f"Erro ao remover produto: {e}", "error")
    return redirect(url_for('admin'))

# Categorias CRUD (admin)
@app.route('/admin/categories/add', methods=['POST'])
def admin_add_category():
    # Verifica login
    if request.cookies.get('admin_auth') != '1':
        flash("Acesso negado", "error")
        return redirect(url_for('admin'))

    nome = (request.form.get('nome') or '').strip()

    if not nome:
        flash("Nome da categoria obrigatório.", "error")
        return redirect(url_for('admin'))

    db = get_db()
    cur = db.cursor()
    try:
        cur.execute("INSERT OR IGNORE INTO categories (name) VALUES (?)", (nome,))
        db.commit()
        flash("Categoria criada com sucesso!", "success")
    except Exception as e:
        db.rollback()
        flash(f"Erro ao criar categoria: {e}", "error")

    return redirect(url_for('admin'))


@app.route('/admin/categories/delete/<int:cat_id>', methods=['POST'])
def admin_delete_category(cat_id):
    if request.cookies.get('admin_auth') != '1':
        flash("Acesso negado", "error")
        return redirect(url_for('admin'))
    db = get_db()
    cur = db.cursor()
    try:
        # opção segura: antes de remover, desassociar produtos (set null)
        cur.execute("UPDATE products SET category_id = NULL WHERE category_id = ?", (cat_id,))
        cur.execute("DELETE FROM categories WHERE id = ?", (cat_id,))
        db.commit()
        flash("Categoria removida.", "success")
    except Exception as e:
        db.rollback()
        flash(f"Erro ao remover categoria: {e}", "error")
    return redirect(url_for('admin'))

# Admin API para listar categorias (JSON) - útil se quiser trocar index para usar API
@app.route('/admin/api/categories')
def admin_api_categories():
    if request.cookies.get('admin_auth') != '1':
        return jsonify({'ok': False, 'error': 'Acesso negado'}), 403
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT id, name FROM categories ORDER BY name")
    rows = cur.fetchall()
    return jsonify([{'id': r['id'], 'name': r['name']} for r in rows])

# -----------------------
# Vendas / notas
# -----------------------
@app.route('/admin/vendas')
def admin_vendas():
    if request.cookies.get('admin_auth') != '1':
        flash("Acesso negado", "error")
        return redirect(url_for('admin'))
    db = get_db()
    cur = db.cursor()
    # 🟢 CORREÇÃO DA ORDENAÇÃO NO RENDER HTML:
    cur.execute("SELECT id, nome_cliente, endereco, telefone, total, forma_pagamento, status, observacoes, delivery_fee, data FROM pedidos ORDER BY id DESC")
    rows = cur.fetchall()
    pedidos = [dict(r) for r in rows]
    return render_template('admin_vendas.html', pedidos=pedidos)

@app.route('/admin/relatorios')
def admin_relatorios():
    if request.cookies.get('admin_auth') != '1':
        flash("Acesso negado", "error")
        return redirect(url_for('admin'))
    
    # Esta rota apenas renderiza o template. O JS fará a busca de dados.
    return render_template('admin_relatorios.html')

# --------------------------------------------------------------------------
# NOVA ROTA: GERAR RELATÓRIO DETALHADO EM PDF
# --------------------------------------------------------------------------
@app.route('/admin/relatorio/csv', methods=['GET'])
def admin_relatorio_csv():
    # 1. Autenticação e Autorização
    if request.cookies.get('admin_auth') != '1':
        return jsonify({"ok": False, "error": "Acesso negado"}), 403

    # 2. Obter e Validar o Período
    periodo = request.args.get('periodo', 'diario') # diario, semanal, mensal
    
    # Fuso horário do Brasil (BRT)
    fuso_brt = timezone(timedelta(hours=-3))
    agora_br = datetime.now(fuso_brt)
    
    if periodo == 'diario':
        # Início do dia na hora local (BRT)
        data_inicio = agora_br.replace(hour=0, minute=0, second=0, microsecond=0)
    elif periodo == 'semanal':
        data_inicio = agora_br - timedelta(days=7)
    elif periodo == 'mensal':
        data_inicio = agora_br - timedelta(days=30)
    else:
        return jsonify({"ok": False, "error": "Período inválido"}), 400

    # Converter para UTC e formatar como string para a query no SQLite
    # Assumindo que o formato salvo no banco é 'YYYY-MM-DD HH:MM:SS'
    data_inicio_utc_str = data_inicio.astimezone(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
    
    # 3. Buscar Dados Detalhados no Banco de Dados
    conn = get_db_connection()
    try:
        query = """
            SELECT
                id,
                nome_cliente,
                total,
                forma_pagamento,
                status,
                data,
                delivery_fee
            FROM pedidos
            WHERE data >= ? 
            ORDER BY data DESC
        """
        pedidos = conn.execute(query, (data_inicio_utc_str,)).fetchall()
    except Exception as e:
        print(f"Erro ao buscar pedidos: {e}")
        return jsonify({"ok": False, "error": f"Erro ao buscar pedidos no banco: {e}"}), 500
    finally:
        conn.close()

    # Variável para acumular o total
    total_geral = 0.0

    # 4. Gerar o Arquivo CSV
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';', quotechar='"', quoting=csv.QUOTE_MINIMAL)

    # Cabeçalho do CSV
    headers = ["ID", "Cliente", "Total (R$)", "Taxa Entrega (R$)", "Forma Pagamento", "Status", "Data_Hora_BRT"]
    writer.writerow(headers)

    # Formato de data assumido no seu banco de dados
    DB_DATE_FORMAT = '%Y-%m-%d %H:%M:%S'
    
    # Preencher as linhas
    for pedido in pedidos:
        # Tenta somar o total
        try:
            total_geral += pedido['total']
        except TypeError:
            # Garante que o total é um número antes de somar
            pass # Apenas ignora se for None ou outro tipo inesperado

        # 4.1. Conversão de Data/Hora (Data do banco (UTC) para BRT)
        try:
            # CORREÇÃO DO ERRO DE DATA: Usamos strptime e removemos info de fuso antes da conversão
            # Assumimos que a data no banco está no formato 'YYYY-MM-DD HH:MM:SS' em UTC
            dt_utc = datetime.strptime(pedido['data'], DB_DATE_FORMAT).replace(tzinfo=timezone.utc)
            
            # Converte para o fuso horário local (BRT)
            dt_br = dt_utc.astimezone(fuso_brt)
            data_formatada = dt_br.strftime('%Y-%m-%d %H:%M:%S')
        except Exception:
            # Caso a string não corresponda ao formato, usamos um valor padrão
            data_formatada = "Data Inválida"

        # 4.2. Escrita da Linha no CSV
        writer.writerow([
            pedido['id'],
            pedido['nome_cliente'] or 'Sem nome',
            f"{pedido['total']:.2f}".replace('.', ','),
            f"{pedido['delivery_fee']:.2f}".replace('.', ','),
            pedido['forma_pagamento'].capitalize(),
            pedido['status'].capitalize(),
            data_formatada
        ])
    
    # 5. ADICIONAR LINHA DE TOTALIZAÇÃO NO FINAL DO CSV
    writer.writerow([]) # Linha em branco para separação
    
    # Linha do total geral
    writer.writerow([
        "TOTAL GERAL:", 
        "", # Cliente
        f"{total_geral:.2f}".replace('.', ','), # Total Formatado
        "", # Taxa Entrega
        "", # Forma Pagamento
        "", # Status
        "" # Data/Hora
    ])
    
    # 6. Retornar o CSV como resposta HTTP
    response = make_response(output.getvalue())
    response.headers["Content-Disposition"] = f"attachment; filename=relatorio_detalhado_{periodo}.csv"
    response.headers["Content-type"] = "text/csv; charset=utf-8"
    
    return response

# Lembre-se de importar get_db_connection se ainda não o fez.

@app.route('/admin/api/vendas')
def api_admin_vendas():
    if request.cookies.get('admin_auth') != '1':
        return jsonify({'ok': False, 'error': 'Acesso negado'}), 403
    db = get_db()
    cur = db.cursor()
    # 🟢 CORREÇÃO DA ORDENAÇÃO NA API:
    cur.execute("SELECT id, nome_cliente, endereco, telefone, total, forma_pagamento, status, observacoes, delivery_fee, data FROM pedidos ORDER BY id DESC")
    rows = cur.fetchall()
    pedidos = [dict(r) for r in rows]
    return jsonify(pedidos)

@app.route('/admin/api/novos-pedidos')
def admin_api_novos_pedidos():
    if request.cookies.get('admin_auth') != '1':
        return jsonify({'ok': False, 'error': 'Acesso negado'}), 403
    
    # 1. Obter o último ID conhecido pelo Admin (via JS)
    try:
        ultimo_admin = int(request.args.get('ultimo', 0))
    except ValueError:
        ultimo_admin = 0

    db = get_db()
    cur = db.cursor()
    
    try:
        # 2. Buscar o ID máximo atual no banco
        cur.execute("SELECT MAX(id) AS maxid FROM pedidos")
        row = cur.fetchone()
        
        # 3. Acesso Simples e Confiável
        max_id = int(row['maxid'] or 0) if row else 0
        
    except Exception as e:
        print(f"ERRO DE BANCO EM NOVOS-PEDIDOS: {e}")
        max_id = 0
    
    # 4. Lógica de comparação (max_id > ultimo_admin)
    if max_id > ultimo_admin:
        # Se for maior, o novo ID a ser notificado é o MAX ID encontrado
        return jsonify({'novo': True, 'pedido_id': max_id})
    
    # Se não houver novidade
    return jsonify({'novo': False})

# NOVA ROTA: Obter detalhes de UMA única venda (Otimização do JS)
@app.route('/admin/api/vendas/<int:pedido_id>')
def api_admin_venda_detail(pedido_id):
    if request.cookies.get('admin_auth') != '1':
        return jsonify({'ok': False, 'error': 'Acesso negado'}), 403
    
    db = get_db()
    cur = db.cursor()
    
    # 1. Busca dados do PEDIDO (Cabeçalho)
    cur.execute("SELECT * FROM pedidos WHERE id = ?", (pedido_id,))
    pedido = cur.fetchone()
    
    if not pedido:
        return jsonify({'ok': False, 'error': 'Venda não encontrada'}), 404
        
    pedido_dict = dict(pedido)

    # 2. Busca os ITENS
    cur.execute("""
        SELECT 
            ip.produto_id,
            ip.name AS nome_produto,
            ip.quantidade,
            ip.preco_unitario,
            ip.options,
            p.name AS product_name
        FROM itens_pedido ip
        LEFT JOIN products p ON p.id = ip.produto_id
        WHERE ip.pedido_id = ?
    """, (pedido_id,))
    
    rows = cur.fetchall()
    itens = []
    for r in rows:
        row = dict(r)
        try:
            row["options"] = json.loads(row.get("options") or "{}")
        except:
            row["options"] = {}
        itens.append(row)

    # Retorna tudo junto para o modal usar
    response = {
        "pedido": pedido_dict,  # Aqui vai ter o delivery_fee correto
        "itens": itens
    }
    
    return jsonify(response)

@app.route('/admin/vendas/<int:pedido_id>/itens')
def admin_venda_itens(pedido_id):
    if request.cookies.get('admin_auth') != '1':
        return jsonify({'ok': False, 'error': 'Acesso negado'}), 403

    db = get_db()
    cur = db.cursor()

    cur.execute("""
        SELECT 
            ip.produto_id,
            ip.name AS nome_produto,
            ip.quantidade,
            ip.preco_unitario,
            ip.options,
            p.name AS product_name
        FROM itens_pedido ip
        LEFT JOIN products p ON p.id = ip.produto_id
        WHERE ip.pedido_id = ?
    """, (pedido_id,))

    rows = cur.fetchall()

    itens = []
    for r in rows:
        row = dict(r)

        # converter JSON de opções
        try:
            row["options"] = json.loads(row.get("options") or "{}")
        except:
            row["options"] = {}

        itens.append(row)

    return jsonify(itens)




@app.route('/admin/vendas/<int:pedido_id>/nota')
def gerar_nota(pedido_id):
    if request.cookies.get('admin_auth') != '1':
        abort(403)

    settings = load_settings_dict()

    restaurant_name = settings.get("site_title", "Meu Restaurante")
    store_cnpj = settings.get("cnpj", "")
    store_address = f"{settings.get('address_street', '')}, {settings.get('address_number', '')}"
    store_city = f"{settings.get('address_city', '')} - {settings.get('address_state', '')}"
    restaurant_desc = settings.get("site_description", "")
    restaurant_phone = settings.get("whatsapp_number", "")
    logo_path = settings.get("logo_path", "")
    background_path = settings.get("background_path", "")
    import json
    from datetime import datetime
    from reportlab.lib import colors
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.enums import TA_CENTER
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle

    # ===============================
    # Função auxiliar: igual modal
    # ===============================
    def montar_descricao_item(options_raw):
        try:
            if isinstance(options_raw, str):
                options = json.loads(options_raw)
            else:
                options = options_raw or {}
        except:
            options = {}

        linhas = []

        # Tamanho
        size = options.get("size") or {}
        if size:
            n = size.get("name") or size.get("nome") or ""
            p = float(size.get("extra_price") or size.get("price") or 0)
            if p > 0:
                linhas.append(f"Tamanho: {n} (+R$ {p:.2f})")
            else:
                linhas.append(f"Tamanho: {n}")

        # Ingredientes
        ingredientes = options.get("ingredients") or []
        if ingredientes:
            nomes = []
            for ig in ingredientes:
                if isinstance(ig, dict):
                    nomes.append(ig.get("name") or ig.get("nome") or "")
                else:
                    nomes.append(str(ig))
            if nomes:
                linhas.append("Sabores: " + ", ".join(nomes))

        # Adicionais
        extras = options.get("extras") or []
        if extras:
            parts = []
            for ex in extras:
                if isinstance(ex, dict):
                    n = ex.get("name") or ""
                    p = float(str(ex.get("price") or 0).replace(",", "."))
                    parts.append(f"{n} (+R$ {p:.2f})")
                else:
                    parts.append(str(ex))
            if parts:
                linhas.append("Adicionais: " + ", ".join(parts))

        return "<br/>".join(linhas)

    # ===============================
    # Buscar pedido
    # ===============================
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT * FROM pedidos WHERE id = ?", (pedido_id,))
    pedido_row = cur.fetchone()
    if not pedido_row:
        abort(404)

    pedido = dict(pedido_row)

    # ===============================
    # Buscar itens do pedido
    # Agora trazendo ip.nome_produto CORRETAMENTE
    # ===============================
    cur.execute("""
        SELECT 
            ip.produto_id,
            ip.name AS nome_produto,
            ip.quantidade,
            ip.preco_unitario,
            ip.options,
            p.name AS product_name
        FROM itens_pedido ip
        LEFT JOIN products p ON p.id = ip.produto_id
        WHERE ip.pedido_id = ?
    """, (pedido_id,))

    itens = [dict(r) for r in cur.fetchall()]

    # ===============================
    # Criar PDF
    # ===============================
    filename = f"nota_{pedido_id}.pdf"
    filepath = os.path.join(app.config['NOTAS_FOLDER'], filename)

    doc = SimpleDocTemplate(
        filepath,
        pagesize=(226, 600),
        leftMargin=10, rightMargin=10, topMargin=12, bottomMargin=12
    )

    styles = getSampleStyleSheet()
    estilo_titulo = ParagraphStyle('Titulo', parent=styles['Normal'], fontSize=12, alignment=TA_CENTER)
    estilo_texto = ParagraphStyle('Texto', parent=styles['Normal'], fontSize=8)
    estilo_negrito = ParagraphStyle('Negrito', parent=styles['Normal'], fontSize=8)
    estilo_item = ParagraphStyle('Item', parent=styles['Normal'], fontSize=7.5, leading=9)

    elementos = []

    # Logo
    if logo_path:
        logo_fs = logo_path.lstrip("/")
    if os.path.exists(logo_fs):
        img = Image(logo_fs, width=60, height=60)
        img.hAlign = 'CENTER'
        elementos.append(img)

    # Cabeçalho
    elementos.append(Paragraph(f"<b>{restaurant_name}</b>", estilo_titulo))
    elementos.append(Spacer(1, 6))

    if store_cnpj:
        elementos.append(Paragraph(f"CNPJ: {store_cnpj}", estilo_texto))

    if store_address.strip(", "):
        elementos.append(Paragraph(store_address, estilo_texto))
    if store_city.strip(" -"):
        elementos.append(Paragraph(store_city, estilo_texto))

    if restaurant_phone:
        elementos.append(Paragraph(f"Tel: {restaurant_phone}", estilo_texto))
    elementos.append(Spacer(1, 10))

    # Infos pedido
    elementos.append(Paragraph(f"<b>Pedido Nº:</b> {pedido_id}", estilo_negrito))
    elementos.append(Paragraph(f"<b>Cliente:</b> {pedido.get('nome_cliente','—')}", estilo_texto))

    # Data
    try:
        dt = datetime.strptime(pedido.get("data",""), "%Y-%m-%d %H:%M:%S")
        data_pedido = dt.strftime("%d/%m/%Y Às %H:%M")
    except:
        data_pedido = pedido.get("data","")

    elementos.append(Paragraph(f"<b>Pedido Emitido em:</b> {data_pedido}", estilo_texto))
    elementos.append(Paragraph(f"<b>Telefone:</b> {pedido.get('telefone','—')}", estilo_texto))
    elementos.append(Paragraph(f"<b>Endereço:</b> {pedido.get('endereco','—')}", estilo_texto))
    elementos.append(Paragraph(f"<b>Pagamento:</b> {pedido.get('forma_pagamento','—')}", estilo_texto))

    if pedido.get("observacoes"):
        elementos.append(Paragraph(f"<b>Obs:</b> {pedido['observacoes']}", estilo_texto))

    elementos.append(Spacer(1, 10))

    # ===============================
    # Tabela de itens
    # ===============================
    tabela_dados = [["QTD", "ITEM", "UNIT", "TOTAL"]]
    subtotal = 0

    for it in itens:
        # nome sempre correto
        nome = it.get("nome_produto") or it.get("product_name") or "Item"

        qtd = it["quantidade"]
        preco = float(it["preco_unitario"])
        total = preco * qtd

        descricao_html = montar_descricao_item(it.get("options"))

        if descricao_html:
            item_paragraph = Paragraph(f"<b>{nome}</b><br/>{descricao_html}", estilo_item)
        else:
            item_paragraph = Paragraph(f"<b>{nome}</b>", estilo_item)

        tabela_dados.append([
            str(qtd),
            item_paragraph,
            f"R$ {preco:.2f}",
            f"R$ {total:.2f}",
        ])

        subtotal += total

    tabela = Table(tabela_dados, colWidths=[25, 95, 45, 45])
    tabela.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.2, colors.black),
        ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTSIZE', (0, 0), (-1, -1), 7),
    ]))

    elementos.append(tabela)
    elementos.append(Spacer(1, 10))

    # Totais
    taxa = float(pedido.get("delivery_fee") or 0)
    total_final = subtotal + taxa

    elementos.append(Paragraph(f"<b>Subtotal:</b> R$ {subtotal:.2f}", estilo_negrito))
    elementos.append(Paragraph(f"<b>Taxa de entrega:</b> R$ {taxa:.2f}", estilo_negrito))
    elementos.append(Paragraph(f"<b>Total Geral:</b> R$ {total_final:.2f}", estilo_negrito))
    elementos.append(Spacer(1, 15))

    elementos.append(Paragraph("Obrigado pela preferência!", estilo_titulo))
    elementos.append(Spacer(1, 5))
    elementos.append(Paragraph("Sistema Desenvolvido Por NTDEV - 71991118924", estilo_texto))

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
    
# -----------------------
# 🟢 NOVA ROTA: RELATÓRIOS 🟢
# -----------------------
@app.route('/admin/api/relatorio')
def admin_api_relatorio():
    if request.cookies.get('admin_auth') != '1':
        return jsonify({'ok': False, 'error': 'Acesso negado'}), 403

    periodo = request.args.get('periodo', 'diario') 
    
    # 1. Configuração de Data e Fuso Horário (Usando now_br())
    agora = now_br().replace(tzinfo=None) # Obtém hora local (UTC-3), sem info de fuso para DB
    
    # 2. Calcule a data de início do relatório
    if periodo == 'diario':
        # Começa à 00:00:00 de hoje
        data_inicio = agora.replace(hour=0, minute=0, second=0, microsecond=0)
    elif periodo == 'semanal':
        # Começa 7 dias atrás
        data_inicio = agora - timedelta(days=7)
    elif periodo == 'mensal':
        # Começa 30 dias atrás
        data_inicio = agora - timedelta(days=30)
    else:
        return jsonify({'ok': False, 'error': 'Período inválido. Use: diario, semanal ou mensal'}), 400
    
    data_inicio_str = data_inicio.strftime('%Y-%m-%d %H:%M:%S')
    
    # 3. Consulta ao Banco de Dados
    db = get_db()
    cur = db.cursor()
    
    sql_query = """
    SELECT 
        SUM(total) AS total_arrecadado, 
        COUNT(id) AS total_vendas
    FROM pedidos 
    WHERE data >= ?
    """
    
    cur.execute(sql_query, (data_inicio_str,))
    resultado = cur.fetchone()

    total_arrecadado = resultado['total_arrecadado'] if resultado and resultado['total_arrecadado'] else 0
    total_vendas = resultado['total_vendas'] if resultado and resultado['total_vendas'] else 0
    
    # 4. Retorna o Relatório
    return jsonify({
        'ok': True,
        'periodo': periodo,
        'data_inicio': data_inicio_str,
        'total_vendas': total_vendas,
        # Garante que o total arrecadado seja um float para o JSON
        'total_arrecadado': float(total_arrecadado)
    })


# -----------------------
# RUN
# -----------------------
if __name__ == '__main__':
    init_db()
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)