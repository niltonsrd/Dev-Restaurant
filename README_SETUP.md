# 🍽️ Sistema de Delivery – Cardápio Online Completo com Painel Administrativo

Sistema completo de **delivery online**, desenvolvido em **Python + Flask**, com **cardápio digital**, **carrinho inteligente**, **checkout avançado**, **integração com WhatsApp**, **itens personalizáveis**, **cálculo automático de frete por CEP** e **painel administrativo seguro**.

O sistema também gera **Nota Fiscal térmica em PDF**, com detalhamento completo dos itens vendidos (tamanhos, ingredientes e adicionais).

---

## 🚀 Principais Funcionalidades

### 🛒 Cardápio Online

* Listagem dinâmica de produtos via API (`/api/products`)
* Filtros por categoria
* Itens simples (quantidade + adicionar)
* Itens personalizáveis via modal:

  * Seleção única de tamanho
  * Seleção única de ingrediente
  * Seleção múltipla de adicionais
* Preço final calculado automaticamente

---

### 🧺 Carrinho Inteligente

* Atualização em tempo real
* Animação do valor total
* Agrupamento correto de itens não personalizáveis
* Resumo completo dos itens selecionados

---

### 🛵 Cálculo Automático de Frete

* Cálculo por CEP com fallback automático:

  * BrasilAPI
  * AwesomeAPI
  * ApiCEP
* Caso nenhuma API responda corretamente:

  * Aplica taxa máxima configurada
* Cálculo de distância com Haversine + Nominatim

---

### 💸 Métodos de Pagamento

* Pix (QR Code automático)
* Dinheiro (com cálculo de troco)
* Cartão

---

### 📄 Painel Administrativo

* Login seguro por cookie
* Listagem completa de pedidos
* Visualização detalhada dos itens
* Download da Nota Fiscal térmica em PDF
* Gerenciamento de produtos e configurações

---

### 🔐 Segurança do Painel

* Senha administrativa com hash
* Alteração de senha via AJAX
* Validações completas no backend
* Feedback visual por modal
* Logout automático após alteração

---

### 🧾 Nota Fiscal Térmica em PDF

* Gerada com ReportLab
* Cabeçalho personalizado
* Logotipo da empresa
* Tabela com itens detalhados
* Subtotal, taxa de entrega e total geral

---

## 🧰 Tecnologias Utilizadas

* Python 3
* Flask
* SQLite
* HTML / CSS / JavaScript
* ReportLab (PDF)
* APIs externas de CEP

---

## 🛠️ Instalação

### 1️⃣ Clone o repositório

```bash
git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
cd SEU_REPOSITORIO
```

### 2️⃣ Crie o ambiente virtual

```bash
python -m venv venv
```

Ative:

**Windows**

```bash
venv\Scripts\activate
```

**Linux/macOS**

```bash
source venv/bin/activate
```

---

### 3️⃣ Instale as dependências

```bash
pip install -r requirements.txt
```

---

### 4️⃣ Execute o projeto

```bash
python app.py
```

Acesse:

* Site: [http://127.0.0.1:5000](http://127.0.0.1:5000)
* Admin: [http://127.0.0.1:5000/admin](http://127.0.0.1:5000/admin)

---

## 📂 Estrutura do Projeto

```
/static
/templates
/database
app.py
requirements.txt
README_SETUP.md
```

---

## 🧪 Rotas Principais

### Público

* `/`
* `/api/products`
* `/api/checkout`

### Admin

* `/admin`
* `/admin/vendas/<id>/itens`
* `/admin/vendas/<id>/nota`

---

## 🔒 Segurança

* Autenticação por cookie seguro
* Senhas com hash
* Validação e sanitização de dados

---

## 📌 Observações

Projeto desenvolvido com foco em **uso real**, **segurança**, **UX profissional** e **organização de código**.

---

🚀 Pronto para produção, estudos ou evolução para SaaS.
