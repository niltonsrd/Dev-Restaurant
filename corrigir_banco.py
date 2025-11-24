import sqlite3

conn = sqlite3.connect('database.db')
cursor = conn.cursor()

print("Iniciando correção forçada das tabelas de variações...")

try:
    # 1. FORÇA a exclusão da tabela (se existir) para garantir a recriação correta
    cursor.execute("DROP TABLE IF EXISTS product_ingredients")
    # 2. Recria a tabela de Ingredientes do Produto COM a coluna ID
    cursor.execute('''
        CREATE TABLE product_ingredients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            name TEXT NOT NULL,
            FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
        )
    ''')
    
    # 3. FORÇA a exclusão da tabela (se existir)
    cursor.execute("DROP TABLE IF EXISTS product_extras")
    # 4. Recria a tabela de Adicionais Pagos COM a coluna ID
    cursor.execute('''
        CREATE TABLE product_extras (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            name TEXT NOT NULL,
            price REAL DEFAULT 0,
            FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
        )
    ''')
    
    conn.commit()
    print("Sucesso! Tabelas 'product_ingredients' e 'product_extras' corrigidas e recriadas.")
    
except Exception as e:
    print(f"Erro ao corrigir o banco: {e}")
finally:
    conn.close()