import sqlite3
import os

DB_PATH = "database.db"  # 🔴 ajuste se o nome do seu banco for diferente

if not os.path.exists(DB_PATH):
    print("❌ Banco de dados não encontrado:", DB_PATH)
    exit(1)

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# garante que a tabela settings existe
cur.execute("""
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
)
""")

# cria usuário admin padrão (se não existir)
cur.execute("""
INSERT OR IGNORE INTO settings (key, value)
VALUES ('admin_user', 'admin')
""")

# cria campo da senha (hash) vazia inicialmente
cur.execute("""
INSERT OR IGNORE INTO settings (key, value)
VALUES ('admin_password_hash', '')
""")

conn.commit()
conn.close()

print("✅ Segurança do admin inicializada com sucesso!")
print("Usuário padrão: admin")
print("Senha ainda não definida (será criada no painel)")
