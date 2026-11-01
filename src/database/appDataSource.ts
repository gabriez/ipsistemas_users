import "reflect-metadata";
import { DataSource } from "typeorm";

import { dataSourceOptionsCommon } from "./databaseConfig.js";
import { CoreSchema1793529059450 } from "./migrations/1793529059450-coreSchema.js";

const AppDataSource = new DataSource({
  ...dataSourceOptionsCommon,
  migrations: [CoreSchema1793529059450],
});

export default AppDataSource;
