# 1. Escolhe uma imagem base Python leve
FROM python:3.11-slim

# 2. Define o diretório de trabalho no contêiner
WORKDIR /app

# 3. Copia e instala dependências
# O arquivo requirements.txt deve listar: flask, gunicorn, mysql-connector-python, etc.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. Copia todo o código da sua aplicação para o contêiner
COPY . .

# 5. Define a porta que o Gunicorn vai escutar (o Cloud Run usa a variável PORT)
ENV PORT 8080

# 6. Comando para iniciar o servidor Gunicorn
# Altere 'app:app' somente se seu objeto Flask estiver em outro lugar
CMD exec gunicorn --bind :$PORT --workers 1 app:app