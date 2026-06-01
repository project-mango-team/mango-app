import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let defaultCategoryKeywords = null;

/**
 * Load category keywords from YAML file
 */
export const loadDefaultCategoryKeywords = () => {
  if (defaultCategoryKeywords) return defaultCategoryKeywords;
  
  try {
    const yamlPath = path.join(__dirname, '../../config/categorias_keywords.yaml');
    const fileContents = fs.readFileSync(yamlPath, 'utf8');
    defaultCategoryKeywords = yaml.load(fileContents);
    return defaultCategoryKeywords;
  } catch (error) {
    console.error('Error loading category keywords:', error);
    return {};
  }
};

const toKeywordEntries = (keywordsOverride) => {
  if (!keywordsOverride) {
    return Object.entries(loadDefaultCategoryKeywords());
  }

  if (keywordsOverride instanceof Map) {
    return Array.from(keywordsOverride.entries());
  }

  if (typeof keywordsOverride === 'object') {
    return Object.entries(keywordsOverride);
  }

  return Object.entries(loadDefaultCategoryKeywords());
};

/**
 * Infer category based on keywords in description
 * @param {string} detalle - Transaction description
 * @returns {string} - Inferred category or "Otros"
 */
export const inferirCategoria = (detalle, keywordsOverride = null) => {
  const detalleUpper = detalle.toUpperCase();

  for (const [categoria, keywordList] of toKeywordEntries(keywordsOverride)) {
    if (!Array.isArray(keywordList)) continue;
    for (const keyword of keywordList) {
      if (detalleUpper.includes(keyword.toUpperCase())) {
        return categoria;
      }
    }
  }
  
  return 'Otros';
};
