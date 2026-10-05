# AusRouter

A frontend interface for AI model routing and interaction.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Lint

```bash
npm run lint
```

## Deployment

Render configuration is available in `render.yaml` at the project root.

### ⚠️ Security Notice

**This is a pure frontend application.** Any API keys or secrets written into Vite configuration, build-time environment variables, or bundled into the client code **will be shipped to the browser and exposed publicly**.

**Do not embed real API keys or private credentials in this codebase.**

For production use with real models:
- Use your own API relay/proxy backend with proper authentication
- Implement CORS policies on the server side
- Never expose production API keys to the client bundle
