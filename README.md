# BeautyStories - Deploy Package para Render

## Instruções de Deploy no Render

### 1. Preparação
- Faça o upload deste pacote no seu GitHub
- Conecte sua conta do Render ao GitHub

### 2. Deploy da Aplicação
1. No Render, clique em "New +" → "Web Service"
2. Conecte ao seu repositório GitHub
3. Configurações recomendadas:
   - **Environment**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn --bind 0.0.0.0:$PORT main:app`

### 3. Variáveis de Ambiente Necessárias
Configure as seguintes variáveis no painel do Render:
- `SESSION_SECRET`: Gere um valor aleatório (Render pode gerar automaticamente)
- `DATABASE_URL`: URL do banco PostgreSQL (se usando Render Database)
- `ABACATEPAY_API_KEY`: Sua chave da API do AbacatePay
- `ABACATEPAY_BASE_URL`: `https://api.abacatepay.com/v1`

### 4. Banco de Dados
Se usar o Render PostgreSQL:
1. Crie um banco de dados no Render
2. Use a URL de conexão fornecida como `DATABASE_URL`

### 5. Domínio
- O Render fornecerá um domínio .render.com gratuitamente
- Você pode configurar um domínio customizado nas configurações

## Arquivos Incluídos
- `main.py`: Arquivo principal da aplicação
- `app.py`: Configuração do Flask
- `routes.py`: Rotas da aplicação  
- `models.py`: Modelos do banco de dados
- `requirements.txt`: Dependências Python otimizadas
- `render.yaml`: Configuração automática (opcional)
- `templates/`: Templates HTML
- `static/`: Arquivos CSS e JS otimizados

## Otimizações Incluídas
- CSS minificado para carregamento mais rápido
- Dependências otimizadas no requirements.txt
- Configuração de cache e compressão
- JavaScript com lazy loading
- Imagens otimizadas

## Suporte
O site está otimizado para:
- Carregamento rápido em dispositivos móveis
- SEO básico
- Performance otimizada
- Tracking com UTMify integrado