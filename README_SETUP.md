🍽️ Sistema de Delivery – Cardápio Online com Itens Personalizáveis + Admin + Nota Fiscal PDF

Este projeto é um sistema completo de delivery, com cardápio digital, carrinho, checkout com taxa de entrega por CEP, integração com WhatsApp, suporte a itens personalizáveis, pagamentos (Pix / Dinheiro / Cartão) e painel administrativo para gerenciar pedidos.

Ele inclui também a geração de Nota Fiscal térmica em PDF, com descrição detalhada de tamanhos, ingredientes e adicionais.

🚀 Principais Funcionalidades
🛒 Cardápio Online

Listagem dinâmica de produtos via /api/products

Filtros por categoria

Itens simples (quantidade + adicionar)

Itens personalizáveis (modal com opções):

Seleção única de tamanho

Seleção única de ingrediente

Seleção múltipla de adicionais

Preço final calculado automaticamente

🧺 Carrinho

Atualização em tempo real

Animação do total (contador crescente)

Resumo completo das opções (tamanho, ingredientes, adicionais)

Garantia de que itens não personalizáveis se agrupam corretamente

🛵 Calcular frete automático

Cálculo baseado no CEP do cliente usando 3 APIs de fallback:

BrasilAPI

AwesomeAPI

ApiCEP

Se nenhuma retornar corretamente:

É aplicada taxa máxima automaticamente

Cálculo da distância → fórmula de Haversine + Nominatim.

💸 Métodos de pagamento

Pix (com geração de QR Code)

Dinheiro (com cálculo de troco)

Cartão

📄 Painel Administrativo

Listagem de todos os pedidos

Modal com itens detalhados

Rota dedicada para itens: /admin/vendas/<id>/itens

Download da Nota Fiscal PDF térmica

Itens personalizados exibem:

Nome correto

Tamanho

Ingredientes

Adicionais com preço

🧾 Nota Fiscal PDF térmica

Gerada via ReportLab, com:

Cabeçalho personalizado

Itens com quebras de linha

Tabela: QTD | ITEM | UNIT | TOTAL

Subtotal, taxa de entrega e total geral

Logotipo da empresa

🧰 Tecnologias Utilizadas

Python 3 + Flask

SQLite

HTML / CSS / JavaScript puro

ReportLab (PDF)

APIs externas de CEP:

BrasilAPI

AwesomeAPI

ApiCEP

Nominatim (Geocoding)

QRServer API (para QR Code Pix)

🛠️ Instalação e Configuração
1️⃣ Clone o projeto
git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
cd SEU_REPOSITORIO

2️⃣ Crie um ambiente virtual
python -m venv venv


Ative:

Windows:

venv\Scripts\activate


Linux/macOS:

source venv/bin/activate

3️⃣ Instale as dependências
pip install -r requirements.txt

4️⃣ Execute o servidor
python app.py


Acesse no navegador:

http://127.0.0.1:5000


Admin:

http://127.0.0.1:5000/admin

📂 Estrutura do Projeto
/static
    /img
/templates
    index.html
    admin.html
/database
app.py
README.md
script.js

🧪 Rotas Principais
▶ Público

/ → cardápio

/api/products → lista de produtos

/api/checkout → finalizar compra

▶ Admin

/admin → painel

/admin/vendas/<id>/itens → itens de um pedido

/admin/api/vendas/<id> → detalhe otimizado

/admin/vendas/<id>/nota → nota fiscal em PDF

🔒 Segurança

Painel admin protegido por cookie admin_auth=1

File uploads (Pix) tratados com segurança

Sanitização de dados no checkout