import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'database.db')

def init_db():
    if os.path.exists(DB_PATH):
        print("Banco já existe em", DB_PATH)
        return

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute('''
    CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        category TEXT,
        image TEXT NOT NULL,
        description TEXT
    )
    ''')

    # produtos iniciais — as imagens devem existir em static/img/
    products = [
        ('X-Burger', 18.90, 'Lanches', 'burger.jpg', 'Hambúrguer com queijo, alface e tomate.'),
        ('Pizza Calabresa', 42.00, 'Lanches', 'pizza.jpg', 'Pizza tradicional com calabresa.'),
        ('Batata Frita', 15.00, 'Acompanhamentos', 'fries.jpg', 'Batatas crocantes.'),
        ('Refrigerante Lata', 6.00, 'Bebidas', 'soda.jpg', 'Refrigerante 350ml em lata.')
    ]

    c.executemany('INSERT INTO products (name, price, category, image, description) VALUES (?, ?, ?, ?, ?)', products)

    conn.commit()
    conn.close()
    print("Banco criado em:", DB_PATH)

if __name__ == '__main__':
    init_db()
