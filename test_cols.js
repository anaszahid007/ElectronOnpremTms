const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(process.env.APPDATA, 'Tailor Manager', 'tailor.db');
const db = new DatabaseSync(dbPath);

const { ALL_MEASUREMENT_KEYS } = require('./out/main/index.js');
// or let's read measurementFields.ts keys

