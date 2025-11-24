import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'database.db')

def init_db():
    if os.path.exists(DB_PATH):
        print("Banco já existe em", DB_PATH)
        return

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # ===========================
    #  TABELA DE CATEGORIAS
    # ===========================
    c.execute('''
    CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
    )
    ''')

    # categorias iniciais
    initial_categories = [
        ('Lanches',),
        ('Acompanhamentos',),
        ('Bebidas',),
        ('Sobremesas',)
    ]

    c.executemany('INSERT INTO categories (name) VALUES (?)', initial_categories)

    c.execute('''CREATE TABLE IF NOT EXISTS product_sizes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    size_name TEXT NOT NULL,
    extra_price REAL DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);''')

    # ===========================
    #  TABELA DE PRODUTOS
    # ===========================
    c.execute('''
    CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        category_id INTEGER,
        image TEXT NOT NULL,
        description TEXT,
        FOREIGN KEY (category_id) REFERENCES categories(id)
    )
    ''')

    # produtos iniciais — lembrando que image deve existir em static/img/
    products = [
        ('X-Burger', 18.90, 1, 'burger.jpg', 'Hambúrguer com queijo, alface e tomate.'),
        ('Pizza Calabresa', 42.00, 1, 'pizza.jpg', 'Pizza tradicional com calabresa.'),
        ('Batata Frita', 15.00, 2, 'fries.jpg', 'Batatas crocantes.'),
        ('Refrigerante Lata', 6.00, 3, 'soda.jpg', 'Refrigerante 350ml em lata.')
    ]

    c.executemany(
        'INSERT INTO products (name, price, category_id, image, description) VALUES (?, ?, ?, ?, ?)',
        products
    )

    conn.commit()
    conn.close()
    print("Banco criado em:", DB_PATH)


if __name__ == '__main__':
    init_db()
