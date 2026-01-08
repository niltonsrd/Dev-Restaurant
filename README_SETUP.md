🍽️ Sistema de Restaurante & Delivery – Flask

Sistema completo de cardápio online, pedidos, pagamento via PIX, painel administrativo e notificações em tempo real, desenvolvido em Flask + SQLite + JavaScript, focado em uso real por restaurantes, pizzarias e lanchonetes.

📸 Visão Geral

Este sistema permite que clientes:

Visualizem o cardápio online

Montem pedidos com produtos personalizados

Escolham entrega ou retirada

Paguem via PIX (QR Code + código copiável)

Enviem comprovante

Acompanhem o pedido via WhatsApp

E permite que o administrador:

Gerencie pedidos em tempo real

Controle status do pedido (pendente → recebido → pronto → saiu para entrega → concluído)

Notifique automaticamente o cliente via WhatsApp

Gerencie produtos, variações, promoções e configurações

Tenha logs completos de ações

Controle pagamentos PIX

🚀 Funcionalidades Principais
🛒 Cliente (Frontend)

Cardápio online responsivo

Produtos com:

Tamanhos

Sabores

Ingredientes

Adicionais

Carrinho dinâmico

Cálculo automático de total

Escolha de:

📦 Entrega

🏪 Retirada no local

Pagamento via PIX

QR Code automático

Código PIX copiável

Envio de comprovante

Envio automático do pedido via WhatsApp

⚡ Pagamento PIX

Geração automática de:

Payload PIX válido (BACEN)

QR Code

Botão “Copiar código PIX” (ideal para celular)

Confirmação automática ou manual no painel

Identificação de:

PIX pendente

PIX enviado

PIX confirmado no balcão

🧑‍💼 Painel Administrativo

Login protegido

Dashboard completo

Lista de pedidos em tempo real

Alteração de status com regras inteligentes:

Entrega → saiu para entrega

Retirada → pronto para retirada

Modal de tempo de preparo

Envio automático de mensagens WhatsApp:

Pedido recebido

Pedido em preparo

Pedido pronto (retirada)

Pedido saiu para entrega

Visualização de comprovantes PIX

Download de nota em PDF

Exclusão de pedidos

Logs completos do sistema

🧾 Status do Pedido
Status	Descrição
pendente	Pedido criado
recebido	Pedido confirmado pelo admin
preparando	Em preparo
pronto	Pronto para retirada
saiu_entrega	Saiu para entrega
concluido	Pedido finalizado
cancelado	Pedido cancelado
🔔 Notificações

WhatsApp automático por status

Notificação sonora no admin

Aba piscando

Favicon piscando

Push Notification (browser)

Modal de novo pedido

🛍️ Produtos e Promoções

CRUD completo de produtos

Variações:

Tamanhos

Ingredientes

Extras

Promoções:

Por valor fixo

Por percentual

Com período de validade

Ativar / pausar promoções

Logs automáticos de alterações

🛠️ Tecnologias Utilizadas
Backend

Python 3

Flask

SQLite

Gunicorn

CRC16 (PIX)

WhatsApp API (link direto)

Frontend

HTML5

CSS3 (layout moderno)

JavaScript puro (Vanilla JS)

Fetch API

Responsivo (Desktop / Mobile)

📁 Estrutura do Projeto
Dev-Restaurant/
│
├── app.py
├── database.db
├── requirements.txt
├── README.md
│
├── static/
│   ├── css/
│   ├── js/
│   ├── img/
│   ├── pix_comprovantes/
│   └── alert.mp3
│
├── templates/
│   ├── index.html
│   ├── admin.html
│   └── base.html
│
└── venv/

⚙️ Instalação Local
# clonar o projeto
git clone https://github.com/seuusuario/seurepositorio.git
cd Dev-Restaurant

# criar ambiente virtual
python3 -m venv venv
source venv/bin/activate

# instalar dependências
pip install -r requirements.txt

# rodar o projeto
python app.py


Acesse:

http://localhost:5000

🖥️ Deploy em Produção (VPS)

Gunicorn

Nginx

Systemd service

HTTPS (recomendado)

Exemplo:

gunicorn app:app --bind 127.0.0.1:8000 --workers 2

🔐 Segurança

Painel admin protegido por cookie

Validações backend

Upload seguro de imagens

Sanitização de dados

Regras de status no backend (não apenas no JS)

📌 Versionamento

O projeto segue Semantic Versioning:

v1.0.0 → versão estável
v1.1.0 → novas funcionalidades
v1.1.1 → correções

🎯 Público-Alvo

Restaurantes

Pizzarias

Lanchonetes

Delivery próprio

Sistemas sob medida para clientes

📄 Licença

Projeto desenvolvido para uso comercial ou personalizado.
A redistribuição sem autorização do autor não é permitida.

👨‍💻 Autor

Nilton Santos
Desenvolvedor Full Stack
Especializado em sistemas web sob medida, automações e soluções para negócios reais.