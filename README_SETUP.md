🍽️ Dev Restaurant – Sistema Completo de Pedidos com Painel Admin
<p align="center"> <img src="https://img.shields.io/badge/Status-Ativo-brightgreen?style=for-the-badge" /> <img src="https://img.shields.io/badge/BackEnd-Flask-blue?style=for-the-badge" /> <img src="https://img.shields.io/badge/Database-SQLite-lightgrey?style=for-the-badge" /> <img src="https://img.shields.io/badge/FrontEnd-HTML/CSS/JS-orange?style=for-the-badge" /> </p>
📌 Sobre o Projeto

O Dev Restaurant é um sistema completo para estabelecimentos de alimentação — incluindo cardápio online, carrinho, pedidos em tempo real, controle administrativo e geração automática de notas em PDF.

O sistema foi desenvolvido com foco em:

rapidez ⚡

usabilidade 📱

funcionamento real para restaurantes 🍕🍔

⚙️ Tecnologias Utilizadas
🖥️ Backend

Python 3

Flask

SQLite

🎨 Frontend

HTML5

CSS3

JavaScript (fetch API)

📄 Outros

Geração de PDF com ReportLab

Notificação de pedidos em tempo real

Sistema de abas no painel admin

🏗️ Estrutura do Projeto
Dev-Restaurant/
│
├── app.py                  # Aplicação Flask principal
├── requirements.txt        # Dependências do Python
├── runtime.txt             # Configuração de ambiente (opcional)
├── Procfile                # Para deploy no Render (opcional)
│
├── static/
│   ├── css/style.css       # Estilos do cliente & admin
│   ├── js/script.js        # Lógica do frontend
│   ├── img/                # Imagens públicas
│   └── favicon.ico         # Ícone do site
│
├── templates/
│   ├── index.html          # Cardápio / site do cliente
│   ├── admin.html          # Painel administrativo
│   └── login_admin.html    # Login do admin
│
└── .gitignore              # Arquivos ignorados no Git

📦 Recursos do Sistema
🛒 Para os Clientes

✔ Cardápio com imagens
✔ Carrinho completo
✔ Preço, quantidade, categorias
✔ Envio do pedido
✔ Geração de comprovante

🖥️ Para o Administrador

✔ Login administrativo
✔ Cadastro/edição de produtos
✔ Controle de vendas
✔ Detalhes da venda com itens
✔ Sistema de notificações ao vivo
✔ Modal de novo pedido
✔ Aba piscando quando chega pedido
✔ Favicon piscando
✔ Notificação push do navegador
✔ Geração de Nota Fiscal em PDF
✔ Filtros por data, cliente e status

🔔 Sistema de Notificações em Tempo Real

Quando um pedido é feito:

✨ Modal aparece
✨ Aba VENDAS começa a piscar
✨ Favicon pisca
✨ Aparece alerta flutuante
✨ Carrega automaticamente caso a aba de vendas esteja aberta
✨ Notificação Push do navegador

100% automático, integrado ao backend.

🛠️ Como Rodar Localmente
# 1. Clonar o repositório
git clone https://github.com/SEU_USUARIO/Dev-Restaurant

# 2. Entrar no projeto
cd Dev-Restaurant

# 3. Criar ambiente virtual
python -m venv venv

# 4. Ativar ambiente
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# 5. Instalar dependências
pip install -r requirements.txt

# 6. Rodar o sistema
python app.py


Acesse em:

👉 http://127.0.0.1:5000/

🚀 Deploy no Render (opcional)

Inclua no repositório:

runtime.txt
Procfile


E faça o deploy facilmente pela dashboard do Render.

🤝 Contribuição

Pull requests são bem-vindos.
Sugestões e melhorias também!

📝 Licença

Este projeto é de uso pessoal/estudo.
Você pode modificar à vontade.

⭐ Se este projeto te ajudou, deixe uma estrela no repositório!