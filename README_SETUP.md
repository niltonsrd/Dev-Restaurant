🍽️ Dev Restaurante — Sistema Completo de Pedidos Online

Dev Restaurante é um sistema completo de pedidos online desenvolvido em Python + Flask, com painel administrativo, geração de notas em PDF, controle de cardápio, pedidos em tempo real, cálculos automáticos de taxa de entrega por bairro e integração com WhatsApp.

É perfeito para lanchonetes, hamburguerias, pizzarias e restaurantes que desejam receber pedidos pelo celular de forma simples, rápida e eficiente.

📱 Funcionalidades Principais
🛒 Sistema de Pedidos Online

Catálogo totalmente dinâmico.

Carrinho inteligente com soma automática.

Método de pagamento: Dinheiro, Cartão ou PIX.

Opção de troco para dinheiro.

Upload de comprovante PIX.

Escolha do bairro com taxa de entrega automática.

Finalização do pedido via WhatsApp com mensagem formatada.

🧾 Geração de Nota Fiscal (PDF)

PDF gerado automaticamente para cada pedido.

Duas versões: padrão e A4.

Informações completas:

Cliente

Endereço

Bairro + taxa de entrega

Lista de itens

Subtotal, Taxa e Total Final

Observações

Layout limpo e totalmente formatado.

🖥️ Painel Administrativo Completo

Disponível em /admin

🔐 Login e autenticação
📦 Gerenciamento do cardápio
🧾 Visualização de pedidos
✔️ Marcar pedidos como concluídos
⬇️ Download da Nota (PDF)
🗑️ Exclusão de pedidos

📊 Banco de Dados (MySQL)

O sistema utiliza MYSQL com tabelas geradas automaticamente ao iniciar:

products — Cardápio

orders — Cabeçalho do pedido

order_items — Itens do pedido

Toda a estrutura é criada automaticamente pela função _ensure_schema_on_start().

📱 Totalmente Responsivo

O layout foi desenvolvido para funcionar perfeitamente em:

📱 Celulares

📟 Tablets

💻 Computadores

Inclui sidebar adaptável e UX otimizada para telas pequenas.

🔧 Tecnologias Utilizadas
Backend

Python

Flask

Jinja2

MySQL Connector

Frontend

HTML5

CSS3 responsivo

JavaScript (DOM puro)

Outros

ReportLab (PDF)

Deploy no Railway

GitHub + Git

🚀 Deploy no Railway

O sistema está preparado para:

✔️ Criar variáveis de ambiente
✔️ Usar PORT do Railway
✔️ Conectar a MySQL externa
✔️ Rodar usando gunicorn (opcional)

📂 Estrutura do Projeto
Dev-Restaurant/
│
├── app.py
├── requirements.txt
├── static/
│   ├── css/
│   ├── js/
│   ├── img/
│   └── notas/          # PDFs gerados (não versionar)
│
├── templates/
│   ├── index.html
│   ├── admin.html
│   └── pedido.html
│
└── README.md

🧪 Como rodar localmente
1️⃣ Instalar dependências
pip install -r requirements.txt

2️⃣ Configure o MySQL no .env ou diretamente no código:
MYSQL_HOST=
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_DATABASE=

3️⃣ Rodar o sistema
python app.py

🌐 Deploy no Railway

Criar um novo projeto

Criar serviço MySQL

Pegar as credenciais e configurar no seu app

Subir o repositório do GitHub

Railway irá detectar Flask automaticamente

Se quiser posso montar um Procfile, ajustes finais e todo o passo-a-passo completo.

🧑‍💻 Desenvolvido por

Nilton Santos — NTDEV
🚀 Desenvolvimento Web e Sistemas Sob Medida