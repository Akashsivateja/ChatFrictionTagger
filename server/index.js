import 'dotenv/config';
import { createBackendApp } from './app.js';

const PORT = Number(process.env.PORT || 3001);
const app = createBackendApp();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Chat Friction Tagger API server listening on http://localhost:${PORT}`);
});
