import {
  statSync,
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const repository = "https://github.com/wero-tracker/wero-tracker-data";
const rawContentBase =
  "https://raw.githubusercontent.com/sharknoon/wero-tracker-data/main";

/**
 * Get file modification time as ISO string
 */
function getLastUpdated(filePath) {
  const stats = statSync(filePath);
  return stats.mtime.toISOString();
}

/**
 * Read and transform a bank's data.json file
 */
function readBankData(bankDir, bankId, countryCode) {
  const dataPath = join(bankDir, "data.json");

  if (!existsSync(dataPath)) {
    console.warn(
      `  - Warning: data.json not found for bank ${bankId} in ${bankDir}`
    );
    return null;
  }

  const rawData = JSON.parse(readFileSync(dataPath, "utf-8"));
  const lastUpdated = getLastUpdated(dataPath);

  // Transform to match the Bank interface
  const bank = {
    id: bankId,
    name: rawData.name,
    status: rawData.status,
    features: {
      p2p: rawData.features?.p2p,
      onlinePayments: rawData.features?.onlinePayments,
      localPayments: rawData.features?.localPayments,
    },
    appAvailability: {
      weroApp: rawData.appAvailability?.weroApp,
      bankingApp: rawData.appAvailability?.bankingApp,
    },
    lastUpdated,
  };

  // Add optional fields if present
  if (rawData.logo) {
    bank.logo = `${rawContentBase}/data/${countryCode}/${bankId}/${rawData.logo}`;
  }
  if (rawData.website) {
    bank.website = rawData.website;
  }
  if (rawData.sources && rawData.sources.length > 0) {
    bank.sources = rawData.sources;
  }
  if (rawData.note) {
    bank.note = rawData.note;
  }

  return bank;
}

/**
 * Read all banks for a country
 */
function readCountryData(countryDir, countryCode) {
  const banks = [];

  const bankDirs = readdirSync(countryDir, { withFileTypes: true });

  for (const bankDir of bankDirs) {
    if (bankDir.isDirectory()) {
      const bankPath = join(countryDir, bankDir.name);
      const bank = readBankData(bankPath, bankDir.name, countryCode);
      if (bank) {
        banks.push(bank);
      }
    }
  }

  // Sort banks alphabetically by name
  banks.sort((a, b) => a.name.localeCompare(b.name));

  return {
    code: countryCode.toUpperCase(),
    banks,
  };
}

/**
 * Bundle all data into a single WeroData object
 */
function bundleData() {
  const rootDir = dirname(fileURLToPath(import.meta.url));
  const dataDir = join(rootDir, "data");
  const countries = [];

  if (!existsSync(dataDir)) {
    console.error("Data directory not found:", dataDir);
    process.exit(1);
  }

  const countryDirs = readdirSync(dataDir, { withFileTypes: true });

  for (const countryDir of countryDirs) {
    if (countryDir.isDirectory()) {
      const countryPath = join(dataDir, countryDir.name);
      const country = readCountryData(countryPath, countryDir.name);
      if (country.banks.length > 0) {
        countries.push(country);
      }
    }
  }

  // Sort countries alphabetically by name
  countries.sort((a, b) => a.name.localeCompare(b.name));

  const weroData = {
    lastUpdated: new Date().toISOString(),
    dataSource: repository,
    countries,
  };

  return weroData;
}

// Main execution
const data = bundleData();
const rootDir = dirname(fileURLToPath(import.meta.url));
const outputPath = join(rootDir, "data.json");

writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf-8");

console.log(`✓ Bundled data written to ${outputPath}`);
console.log(`  - ${data.countries.length} countries`);
console.log(
  `  - ${data.countries.reduce(
    (sum, c) => sum + c.banks.length,
    0
  )} banks total`
);
