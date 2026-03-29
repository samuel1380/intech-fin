<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/17nJ7sxE2lHkJj1Eas8h9IOQCJDGD6Ghe

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `OPENAI_API_KEY` in [.env.local](.env.local) to your OpenRouter API key
3. Run the app:
   `npm run dev`

## Deploy to Render

Para subir este projeto no **Render**, siga estes passos:

1. **Crie um novo Static Site** no seu painel do Render.
2. **Conecte seu repositório** GitHub ou GitLab.
3. O Render detectará automaticamente o arquivo `render.yaml` e configurará os campos:
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
4. **Variáveis de Ambiente:** Adicione a variável `OPENAI_API_KEY` nas configurações do Render com sua chave da API do OpenRouter. As outras variáveis (`AI_BASE_URL`, `AI_MODEL`, `AI_PROVIDER`) já estão configuradas no `render.yaml`.
5. O Render cuidará do roteamento de SPA automaticamente graças à configuração no `render.yaml`.
