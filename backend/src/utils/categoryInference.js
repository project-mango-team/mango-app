import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let categoriaKeywords = null;

/**
 * Load category keywords from YAML file
 */
export const loadCategoryKeywords = () => {
  if (categoriaKeywords) return categoriaKeywords;
  
  try {
    const yamlPath = path.join(__dirname, '../../config/categorias_keywords.yaml');
    const fileContents = fs.readFileSync(yamlPath, 'utf8');
    categoriaKeywords = yaml.load(fileContents);
    return categoriaKeywords;
  } catch (error) {
    console.error('Error loading category keywords:', error);
    return {};
  }
};

/**
 * Infer category based on keywords in description
 * @param {string} detalle - Transaction description
 * @returns {string} - Inferred category or "Otros"
 */
export const inferirCategoria = (detalle) => {
  const keywords = loadCategoryKeywords();
  const detalleUpper = detalle.toUpperCase();
  
  for (const [categoria, keywordList] of Object.entries(keywords)) {
    for (const keyword of keywordList) {
      if (detalleUpper.includes(keyword.toUpperCase())) {
        return categoria;
      }
    }
  }
  
  return 'Otros';
};
