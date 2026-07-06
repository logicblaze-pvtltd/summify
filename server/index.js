import { initDatabase } from "./database.js";
import { PORT } from "./config.js";
import { createApp } from "./app.js";
import { migrateLegacyDocumentsIfNeeded } from "./services/fileStore.js";

const app = createApp();

initDatabase()
  .then(async () => {
    await migrateLegacyDocumentsIfNeeded();
    app.listen(PORT, () => {
      console.log(`Server is running securely on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database initialization failed. Exiting...", error);
    process.exit(1);
  });
